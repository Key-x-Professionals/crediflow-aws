# Sesión 2 · Reto para casa (opcional, 30-40 min, sin costo)

**Objetivo.** Un bucket que (1) rechaza cualquier petición que no llegue por HTTPS y (2) guarda las versiones anteriores de cada objeto, de modo que puedas recuperar un archivo borrado.

**Cómo.** Crea el bucket y aplícale una política con un `Deny` cuando `aws:SecureTransport` sea `false`; después activa el versionado:

```bash
# Mac
export RETO=crediflow-$CF_STUDENT-reto2-$CDK_DEFAULT_ACCOUNT
aws s3 mb s3://$RETO
cat > politica-https.json <<EOF
{"Version":"2012-10-17","Statement":[{"Sid":"SoloHTTPS","Effect":"Deny","Principal":"*","Action":"s3:*",
  "Resource":["arn:aws:s3:::$RETO","arn:aws:s3:::$RETO/*"],
  "Condition":{"Bool":{"aws:SecureTransport":"false"}}}]}
EOF
aws s3api put-bucket-policy --bucket $RETO --policy file://politica-https.json
aws s3api put-bucket-versioning --bucket $RETO --versioning-configuration Status=Enabled
echo "version 1" > doc.txt && aws s3 cp doc.txt s3://$RETO/doc.txt
echo "version 2" > doc.txt && aws s3 cp doc.txt s3://$RETO/doc.txt
aws s3 rm s3://$RETO/doc.txt
```

En Windows usa `$env:RETO = "crediflow-$env:CF_STUDENT-reto2-$env:CDK_DEFAULT_ACCOUNT"`, escribe el JSON en `politica-https.json` con VS Code (reemplazando el nombre del bucket) y los mismos comandos con `$env:RETO`.

**Cómo comprobar.** Primero, que HTTP queda rechazado y HTTPS no:

```bash
aws s3 ls s3://$RETO --endpoint-url http://s3.us-east-1.amazonaws.com     # AccessDenied
aws s3 ls s3://$RETO                                                       # funciona (vacío: borraste el archivo)
```

Después, que el archivo se puede recuperar. Lista las versiones: verás dos versiones de `doc.txt` y una **marca de borrado** (*delete marker*). Borrar la marca "des-borra" el objeto:

```bash
aws s3api list-object-versions --bucket $RETO --query '{Versiones:Versions[].[Key,VersionId,IsLatest],Marcas:DeleteMarkers[].[Key,VersionId]}'
aws s3api delete-object --bucket $RETO --key doc.txt --version-id <VersionId de la marca>
aws s3 cp s3://$RETO/doc.txt -                                             # imprime "version 2"
```

**Qué entregas.** En el canal del curso: tu `politica-https.json` y una captura con el `AccessDenied` por HTTP y con el archivo recuperado. Si usaste IA, cuenta qué le pediste y qué tuviste que corregir.

**Limpieza del reto.** Un bucket con versionado no se vacía con `rb --force`: hay que borrar todas las versiones y marcas. Lo más simple es desde la consola (**S3 → tu bucket → Empty**, y luego **Delete**), o por CLI:

```bash
aws s3api delete-objects --bucket $RETO --delete "$(aws s3api list-object-versions --bucket $RETO --query '{Objects: [Versions,DeleteMarkers][][].{Key:Key,VersionId:VersionId}}' --output json)"
aws s3 rb s3://$RETO
```

**Bonus.** Agrega una regla de ciclo de vida que elimine las versiones no vigentes a los 7 días (`aws s3api put-bucket-lifecycle-configuration`). ¿Por qué conviene tenerla siempre que se activa el versionado?
