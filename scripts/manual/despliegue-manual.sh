#!/usr/bin/env bash
# =============================================================================
# Sesión 2 · Despliegue "artesanal" de CrediFlow con la AWS CLI (Mac/Linux)
#
# Uso:   ./scripts/manual/despliegue-manual.sh <paso>
# Pasos: red | seguridad | datos | codigo | servidor | verificar | limpiar | todo
#
# Cada paso guarda los IDs creados en scripts/manual/estado.out para poder
# continuar y para que el documento despliegue-manual.md tenga evidencia.
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")/../.."
set -a; source .env; set +a
export AWS_PAGER=""
REGION="${CDK_DEFAULT_REGION:-us-east-1}"
P="crediflow-${CF_STUDENT}-manual"            # prefijo de todo lo que creamos a mano
ESTADO="scripts/manual/estado.out"
touch "$ESTADO"; set -a; source "$ESTADO"; set +a
guardar() { grep -v "^$1=" "$ESTADO" > "$ESTADO.tmp" || true; echo "$1=$2" >> "$ESTADO.tmp"; mv "$ESTADO.tmp" "$ESTADO"; export "$1=$2"; echo "   $1=$2"; }
tag() { aws ec2 create-tags --resources "$1" --tags Key=Name,Value="$2" Key=Student,Value="$CF_STUDENT" Key=Project,Value=crediflow Key=ManagedBy,Value=manual --region "$REGION"; }

paso_red() {
  echo "== 1. Red: VPC, subredes, internet gateway y rutas"
  VPC_ID=$(aws ec2 create-vpc --cidr-block 10.1.0.0/16 --query Vpc.VpcId --output text --region "$REGION"); tag "$VPC_ID" "$P-vpc"; guardar VPC_ID "$VPC_ID"
  aws ec2 modify-vpc-attribute --vpc-id "$VPC_ID" --enable-dns-hostnames --region "$REGION"
  AZ1="${REGION}a"; AZ2="${REGION}b"
  SUB_PUB1=$(aws ec2 create-subnet --vpc-id "$VPC_ID" --cidr-block 10.1.0.0/24 --availability-zone "$AZ1" --query Subnet.SubnetId --output text --region "$REGION"); tag "$SUB_PUB1" "$P-public-a"; guardar SUB_PUB1 "$SUB_PUB1"
  SUB_PUB2=$(aws ec2 create-subnet --vpc-id "$VPC_ID" --cidr-block 10.1.1.0/24 --availability-zone "$AZ2" --query Subnet.SubnetId --output text --region "$REGION"); tag "$SUB_PUB2" "$P-public-b"; guardar SUB_PUB2 "$SUB_PUB2"
  SUB_PRIV1=$(aws ec2 create-subnet --vpc-id "$VPC_ID" --cidr-block 10.1.10.0/24 --availability-zone "$AZ1" --query Subnet.SubnetId --output text --region "$REGION"); tag "$SUB_PRIV1" "$P-private-a"; guardar SUB_PRIV1 "$SUB_PRIV1"
  SUB_PRIV2=$(aws ec2 create-subnet --vpc-id "$VPC_ID" --cidr-block 10.1.11.0/24 --availability-zone "$AZ2" --query Subnet.SubnetId --output text --region "$REGION"); tag "$SUB_PRIV2" "$P-private-b"; guardar SUB_PRIV2 "$SUB_PRIV2"
  aws ec2 modify-subnet-attribute --subnet-id "$SUB_PUB1" --map-public-ip-on-launch --region "$REGION"
  IGW_ID=$(aws ec2 create-internet-gateway --query InternetGateway.InternetGatewayId --output text --region "$REGION"); tag "$IGW_ID" "$P-igw"; guardar IGW_ID "$IGW_ID"
  aws ec2 attach-internet-gateway --internet-gateway-id "$IGW_ID" --vpc-id "$VPC_ID" --region "$REGION"
  RT_ID=$(aws ec2 create-route-table --vpc-id "$VPC_ID" --query RouteTable.RouteTableId --output text --region "$REGION"); tag "$RT_ID" "$P-rt-public"; guardar RT_ID "$RT_ID"
  aws ec2 create-route --route-table-id "$RT_ID" --destination-cidr-block 0.0.0.0/0 --gateway-id "$IGW_ID" --region "$REGION" > /dev/null
  aws ec2 associate-route-table --route-table-id "$RT_ID" --subnet-id "$SUB_PUB1" --region "$REGION" > /dev/null
  aws ec2 associate-route-table --route-table-id "$RT_ID" --subnet-id "$SUB_PUB2" --region "$REGION" > /dev/null
  echo "✅ Red lista"
}

paso_seguridad() {
  echo "== 2. Security groups: app (80 desde internet) y db (5432 solo desde app)"
  SG_APP=$(aws ec2 create-security-group --group-name "$P-sg-app" --description "CrediFlow API manual" --vpc-id "$VPC_ID" --query GroupId --output text --region "$REGION"); tag "$SG_APP" "$P-sg-app"; guardar SG_APP "$SG_APP"
  aws ec2 authorize-security-group-ingress --group-id "$SG_APP" --protocol tcp --port 80 --cidr "${CF_ALLOWED_CIDR:-0.0.0.0/0}" --region "$REGION" > /dev/null
  SG_DB=$(aws ec2 create-security-group --group-name "$P-sg-db" --description "CrediFlow DB manual" --vpc-id "$VPC_ID" --query GroupId --output text --region "$REGION"); tag "$SG_DB" "$P-sg-db"; guardar SG_DB "$SG_DB"
  aws ec2 authorize-security-group-ingress --group-id "$SG_DB" --protocol tcp --port 5432 --source-group "$SG_APP" --region "$REGION" > /dev/null
  echo "✅ Security groups listos"
}

paso_datos() {
  echo "== 3. Datos: bucket S3, secreto y RDS PostgreSQL"
  BUCKET="$P-$CDK_DEFAULT_ACCOUNT"; guardar BUCKET "$BUCKET"
  if [ "$REGION" = "us-east-1" ]; then aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" > /dev/null; else aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" --create-bucket-configuration LocationConstraint="$REGION" > /dev/null; fi
  aws s3api put-public-access-block --bucket "$BUCKET" --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true --region "$REGION"
  aws s3api put-bucket-encryption --bucket "$BUCKET" --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}' --region "$REGION"

  DB_PASS=$(aws secretsmanager get-random-password --password-length 24 --exclude-punctuation --query RandomPassword --output text --region "$REGION")
  aws rds create-db-subnet-group --db-subnet-group-name "$P-subnets" --db-subnet-group-description "CrediFlow manual" --subnet-ids "$SUB_PRIV1" "$SUB_PRIV2" --region "$REGION" > /dev/null
  aws rds create-db-instance --db-instance-identifier "$P-db" --db-instance-class db.t4g.micro --engine postgres --engine-version 16 \
    --master-username crediflow_admin --master-user-password "$DB_PASS" --db-name crediflow \
    --allocated-storage 20 --storage-encrypted --no-publicly-accessible --no-multi-az \
    --vpc-security-group-ids "$SG_DB" --db-subnet-group-name "$P-subnets" --backup-retention-period 0 \
    --tags Key=Student,Value="$CF_STUDENT" Key=Project,Value=crediflow Key=ManagedBy,Value=manual --region "$REGION" > /dev/null
  echo "   Esperando a que RDS esté disponible (5-8 min)..."
  aws rds wait db-instance-available --db-instance-identifier "$P-db" --region "$REGION"
  DB_HOST=$(aws rds describe-db-instances --db-instance-identifier "$P-db" --query 'DBInstances[0].Endpoint.Address' --output text --region "$REGION"); guardar DB_HOST "$DB_HOST"
  DB_SECRET="crediflow/$CF_STUDENT/manual/db"; guardar DB_SECRET "$DB_SECRET"
  aws secretsmanager create-secret --name "$DB_SECRET" --secret-string "{\"host\":\"$DB_HOST\",\"port\":5432,\"dbname\":\"crediflow\",\"username\":\"crediflow_admin\",\"password\":\"$DB_PASS\"}" --region "$REGION" > /dev/null
  echo "✅ Datos listos"
}

paso_codigo() {
  echo "== 4. Código: empaquetar la API y subirla a S3"
  (cd apps/api && zip -qr ../../scripts/manual/api.zip package.json tsconfig.json src -x '*.test.ts')
  aws s3 cp scripts/manual/api.zip "s3://$BUCKET/releases/api.zip" --region "$REGION"
  echo "✅ Código en s3://$BUCKET/releases/api.zip"
}

paso_servidor() {
  echo "== 5. Servidor: rol IAM, instance profile y EC2 con user data"
  ROLE="$P-ec2-role"; guardar ROLE "$ROLE"
  aws iam create-role --role-name "$ROLE" --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ec2.amazonaws.com"},"Action":"sts:AssumeRole"}]}' > /dev/null
  aws iam attach-role-policy --role-name "$ROLE" --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore
  aws iam put-role-policy --role-name "$ROLE" --policy-name crediflow-minimo --policy-document "{\"Version\":\"2012-10-17\",\"Statement\":[
    {\"Effect\":\"Allow\",\"Action\":[\"s3:GetObject\",\"s3:PutObject\",\"s3:ListBucket\"],\"Resource\":[\"arn:aws:s3:::$BUCKET\",\"arn:aws:s3:::$BUCKET/*\"]},
    {\"Effect\":\"Allow\",\"Action\":\"secretsmanager:GetSecretValue\",\"Resource\":\"arn:aws:secretsmanager:$REGION:$CDK_DEFAULT_ACCOUNT:secret:$DB_SECRET-*\"}]}"
  aws iam create-instance-profile --instance-profile-name "$ROLE" > /dev/null
  aws iam add-role-to-instance-profile --instance-profile-name "$ROLE" --role-name "$ROLE"
  echo "   Esperando propagación de IAM (10 s)..."; sleep 10

  AMI=$(aws ssm get-parameter --name /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64 --query Parameter.Value --output text --region "$REGION")
  sed -e "s|__BUCKET__|$BUCKET|g" -e "s|__DB_SECRET__|$DB_SECRET|g" -e "s|__REGION__|$REGION|g" -e "s|__STUDENT__|$CF_STUDENT|g" scripts/manual/user-data.sh > scripts/manual/user-data.rendered.out
  INSTANCE_ID=$(aws ec2 run-instances --image-id "$AMI" --instance-type t3.micro --subnet-id "$SUB_PUB1" --security-group-ids "$SG_APP" \
    --iam-instance-profile Name="$ROLE" --user-data file://scripts/manual/user-data.rendered.out --associate-public-ip-address \
    --metadata-options HttpTokens=required \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=$P-api},{Key=Student,Value=$CF_STUDENT},{Key=Project,Value=crediflow},{Key=ManagedBy,Value=manual}]" \
    --query 'Instances[0].InstanceId' --output text --region "$REGION"); guardar INSTANCE_ID "$INSTANCE_ID"
  aws ec2 wait instance-running --instance-ids "$INSTANCE_ID" --region "$REGION"
  PUBLIC_IP=$(aws ec2 describe-instances --instance-ids "$INSTANCE_ID" --query 'Reservations[0].Instances[0].PublicIpAddress' --output text --region "$REGION"); guardar PUBLIC_IP "$PUBLIC_IP"
  echo "✅ EC2 arrancando. La API tardará ~2 min en instalarse. URL: http://$PUBLIC_IP"
}

paso_verificar() {
  echo "== 6. Verificación"
  echo "   curl http://$PUBLIC_IP/health"; curl -s --max-time 5 "http://$PUBLIC_IP/health" || echo "   (todavía no responde, espera un minuto y repite)"
  echo; echo "   Sesión en el servidor sin SSH:  aws ssm start-session --target $INSTANCE_ID --region $REGION"
  echo "   Logs de instalación en el servidor:  sudo tail -f /var/log/crediflow-user-data.log"
}

paso_limpiar() {
  echo "== Limpieza de TODO lo creado a mano (orden inverso)"
  aws ec2 terminate-instances --instance-ids "$INSTANCE_ID" --region "$REGION" > /dev/null && aws ec2 wait instance-terminated --instance-ids "$INSTANCE_ID" --region "$REGION" || true
  aws iam remove-role-from-instance-profile --instance-profile-name "$ROLE" --role-name "$ROLE" || true
  aws iam delete-instance-profile --instance-profile-name "$ROLE" || true
  aws iam delete-role-policy --role-name "$ROLE" --policy-name crediflow-minimo || true
  aws iam detach-role-policy --role-name "$ROLE" --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore || true
  aws iam delete-role --role-name "$ROLE" || true
  aws rds delete-db-instance --db-instance-identifier "$P-db" --skip-final-snapshot --delete-automated-backups --region "$REGION" > /dev/null || true
  echo "   Esperando a que RDS se elimine (5 min)..."; aws rds wait db-instance-deleted --db-instance-identifier "$P-db" --region "$REGION" || true
  aws rds delete-db-subnet-group --db-subnet-group-name "$P-subnets" --region "$REGION" || true
  aws secretsmanager delete-secret --secret-id "$DB_SECRET" --force-delete-without-recovery --region "$REGION" > /dev/null || true
  aws s3 rm "s3://$BUCKET" --recursive --region "$REGION" || true; aws s3api delete-bucket --bucket "$BUCKET" --region "$REGION" || true
  aws ec2 delete-security-group --group-id "$SG_DB" --region "$REGION" || true
  aws ec2 delete-security-group --group-id "$SG_APP" --region "$REGION" || true
  for s in "$SUB_PUB1" "$SUB_PUB2" "$SUB_PRIV1" "$SUB_PRIV2"; do aws ec2 delete-subnet --subnet-id "$s" --region "$REGION" || true; done
  aws ec2 delete-route-table --route-table-id "$RT_ID" --region "$REGION" || true
  aws ec2 detach-internet-gateway --internet-gateway-id "$IGW_ID" --vpc-id "$VPC_ID" --region "$REGION" || true
  aws ec2 delete-internet-gateway --internet-gateway-id "$IGW_ID" --region "$REGION" || true
  aws ec2 delete-vpc --vpc-id "$VPC_ID" --region "$REGION" || true
  rm -f "$ESTADO" scripts/manual/api.zip scripts/manual/user-data.rendered.out
  echo "✅ Limpieza terminada"
}

case "${1:-}" in
  red) paso_red ;; seguridad) paso_seguridad ;; datos) paso_datos ;; codigo) paso_codigo ;; servidor) paso_servidor ;; verificar) paso_verificar ;; limpiar) paso_limpiar ;;
  todo) paso_red; paso_seguridad; paso_datos; paso_codigo; paso_servidor; paso_verificar ;;
  *) echo "Uso: $0 red|seguridad|datos|codigo|servidor|verificar|limpiar|todo"; exit 1 ;;
esac
