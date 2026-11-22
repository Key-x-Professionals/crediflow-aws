/**
 * Almacenamiento de solicitudes con tres implementaciones (se elige con STORAGE):
 *   - memory:   para correr local sin base de datos
 *   - postgres: RDS, en el despliegue manual de la sesión 2
 *   - dynamo:   DynamoDB, desde la sesión 3 (sin costo fijo, sin VPC ni secretos)
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';
import { Pool } from 'pg';
import { Estado, NuevaSolicitud, Solicitud } from './domain';

export interface Storage {
  readonly kind: 'memory' | 'postgres' | 'dynamo';
  init(): Promise<void>;
  ping(): Promise<boolean>;
  crear(input: NuevaSolicitud, estado: Estado): Promise<Solicitud>;
  listar(limit?: number): Promise<Solicitud[]>;
  obtener(id: string): Promise<Solicitud | undefined>;
  actualizarEstado(id: string, estado: Estado, resultado?: Solicitud['resultado']): Promise<Solicitud | undefined>;
  close(): Promise<void>;
}

// ---------------------------------------------------------------------------
export class MemoryStorage implements Storage {
  readonly kind = 'memory' as const;
  private readonly items = new Map<string, Solicitud>();

  async init(): Promise<void> {}
  async ping(): Promise<boolean> {
    return true;
  }
  async crear(input: NuevaSolicitud, estado: Estado): Promise<Solicitud> {
    const now = new Date().toISOString();
    const s: Solicitud = { id: randomUUID(), ...input, estado, creadaEn: now, actualizadaEn: now };
    this.items.set(s.id, s);
    return s;
  }
  async listar(limit = 50): Promise<Solicitud[]> {
    return [...this.items.values()].sort((a, b) => b.creadaEn.localeCompare(a.creadaEn)).slice(0, limit);
  }
  async obtener(id: string): Promise<Solicitud | undefined> {
    return this.items.get(id);
  }
  async actualizarEstado(id: string, estado: Estado, resultado?: Solicitud['resultado']): Promise<Solicitud | undefined> {
    const s = this.items.get(id);
    if (!s) return undefined;
    const updated = { ...s, estado, resultado: resultado ?? s.resultado, actualizadaEn: new Date().toISOString() };
    this.items.set(id, updated);
    return updated;
  }
  async close(): Promise<void> {}
}

// ---------------------------------------------------------------------------
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS solicitudes (
  id              UUID PRIMARY KEY,
  nombre          TEXT NOT NULL,
  documento       TEXT NOT NULL,
  monto           NUMERIC(12,2) NOT NULL,
  plazo_meses     INTEGER NOT NULL,
  ingreso_mensual NUMERIC(12,2) NOT NULL,
  proposito       TEXT NOT NULL,
  estado          TEXT NOT NULL,
  resultado       JSONB,
  creada_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizada_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS solicitudes_creada_en_idx ON solicitudes (creada_en DESC);
`;

interface Row {
  id: string;
  nombre: string;
  documento: string;
  monto: string;
  plazo_meses: number;
  ingreso_mensual: string;
  proposito: string;
  estado: Estado;
  resultado: Solicitud['resultado'] | null;
  creada_en: Date;
  actualizada_en: Date;
}

function toSolicitud(r: Row): Solicitud {
  return {
    id: r.id,
    nombre: r.nombre,
    documento: r.documento,
    monto: Number(r.monto),
    plazoMeses: r.plazo_meses,
    ingresoMensual: Number(r.ingreso_mensual),
    proposito: r.proposito as Solicitud['proposito'],
    estado: r.estado,
    resultado: r.resultado ?? undefined,
    creadaEn: r.creada_en.toISOString(),
    actualizadaEn: r.actualizada_en.toISOString(),
  };
}

export class PostgresStorage implements Storage {
  readonly kind = 'postgres' as const;
  private readonly pool: Pool;

  constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT ?? 5432),
      database: process.env.DB_NAME ?? 'crediflow',
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      max: 5,
      ssl: process.env.DB_SSL === 'false' ? undefined : { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000,
    });
  }

  async init(): Promise<void> {
    await this.pool.query(SCHEMA_SQL);
  }

  async ping(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  async crear(input: NuevaSolicitud, estado: Estado): Promise<Solicitud> {
    const id = randomUUID();
    const { rows } = await this.pool.query<Row>(
      `INSERT INTO solicitudes (id, nombre, documento, monto, plazo_meses, ingreso_mensual, proposito, estado)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [id, input.nombre, input.documento, input.monto, input.plazoMeses, input.ingresoMensual, input.proposito, estado],
    );
    return toSolicitud(rows[0]);
  }

  async listar(limit = 50): Promise<Solicitud[]> {
    const { rows } = await this.pool.query<Row>('SELECT * FROM solicitudes ORDER BY creada_en DESC LIMIT $1', [limit]);
    return rows.map(toSolicitud);
  }

  async obtener(id: string): Promise<Solicitud | undefined> {
    const { rows } = await this.pool.query<Row>('SELECT * FROM solicitudes WHERE id = $1', [id]);
    return rows[0] ? toSolicitud(rows[0]) : undefined;
  }

  async actualizarEstado(id: string, estado: Estado, resultado?: Solicitud['resultado']): Promise<Solicitud | undefined> {
    const { rows } = await this.pool.query<Row>(
      `UPDATE solicitudes SET estado = $2, resultado = COALESCE($3::jsonb, resultado), actualizada_en = now()
       WHERE id = $1 RETURNING *`,
      [id, estado, resultado ? JSON.stringify(resultado) : null],
    );
    return rows[0] ? toSolicitud(rows[0]) : undefined;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

// ---------------------------------------------------------------------------
/**
 * DynamoDB: un ítem por solicitud (pk = id). Para listar las últimas se usa el
 * índice `porFecha` (gsi1pk = "SOLICITUD", ordenado por creadaEn).
 */
export class DynamoStorage implements Storage {
  readonly kind = 'dynamo' as const;
  private readonly ddb: DynamoDBDocumentClient;
  private readonly table: string;

  constructor(tableName = process.env.TABLE_NAME ?? '') {
    if (!tableName) throw new Error('STORAGE=dynamo requiere TABLE_NAME');
    this.table = tableName;
    this.ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}), { marshallOptions: { removeUndefinedValues: true } });
  }

  async init(): Promise<void> {}

  async ping(): Promise<boolean> {
    try {
      await this.ddb.send(new GetCommand({ TableName: this.table, Key: { id: 'ping' } }));
      return true;
    } catch {
      return false;
    }
  }

  async crear(input: NuevaSolicitud, estado: Estado): Promise<Solicitud> {
    const now = new Date().toISOString();
    const s: Solicitud = { id: randomUUID(), ...input, estado, creadaEn: now, actualizadaEn: now };
    await this.ddb.send(new PutCommand({ TableName: this.table, Item: { ...s, gsi1pk: 'SOLICITUD' } }));
    return s;
  }

  async listar(limit = 50): Promise<Solicitud[]> {
    const { Items = [] } = await this.ddb.send(
      new QueryCommand({
        TableName: this.table,
        IndexName: 'porFecha',
        KeyConditionExpression: 'gsi1pk = :pk',
        ExpressionAttributeValues: { ':pk': 'SOLICITUD' },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    return Items.map(({ gsi1pk: _g, ...rest }) => rest as Solicitud);
  }

  async obtener(id: string): Promise<Solicitud | undefined> {
    const { Item } = await this.ddb.send(new GetCommand({ TableName: this.table, Key: { id } }));
    if (!Item) return undefined;
    const { gsi1pk: _g, ...rest } = Item;
    return rest as Solicitud;
  }

  async actualizarEstado(id: string, estado: Estado, resultado?: Solicitud['resultado']): Promise<Solicitud | undefined> {
    try {
      const { Attributes } = await this.ddb.send(
        new UpdateCommand({
          TableName: this.table,
          Key: { id },
          ConditionExpression: 'attribute_exists(id)',
          UpdateExpression: resultado
            ? 'SET estado = :e, resultado = :r, actualizadaEn = :t'
            : 'SET estado = :e, actualizadaEn = :t',
          ExpressionAttributeValues: { ':e': estado, ':t': new Date().toISOString(), ...(resultado ? { ':r': resultado } : {}) },
          ReturnValues: 'ALL_NEW',
        }),
      );
      const { gsi1pk: _g, ...rest } = Attributes ?? {};
      return rest as Solicitud;
    } catch (err: any) {
      if (err?.name === 'ConditionalCheckFailedException') return undefined;
      throw err;
    }
  }

  async close(): Promise<void> {}
}

export function createStorage(): Storage {
  const kind = (process.env.STORAGE ?? (process.env.TABLE_NAME ? 'dynamo' : process.env.DB_HOST ? 'postgres' : 'memory')).toLowerCase();
  if (kind === 'dynamo') return new DynamoStorage();
  if (kind === 'postgres') return new PostgresStorage();
  return new MemoryStorage();
}
