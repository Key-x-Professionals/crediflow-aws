#!/usr/bin/env bash
# =============================================================================
# Instructor · Limpia lo que UN alumno creó en la sesión 2 (despliegue manual) y lo
# que dejó de la sesión 1 (bucket y rol lab1), sin necesitar su estado.out: busca por nombre.
#
# Uso:   ./scripts/manual/limpiar-alumno.sh <usuario>              # solo LISTA (no borra nada)
#        ./scripts/manual/limpiar-alumno.sh <usuario> --ejecutar   # BORRA (no se puede deshacer)
# Ej.:   ./scripts/manual/limpiar-alumno.sh ludwin.mejia
#
# Requiere un perfil con permisos de administrador (el del .env).
# =============================================================================
set -uo pipefail
cd "$(dirname "$0")/../.."
set -a; source .env; set +a
export AWS_PAGER=""
REGION="${CDK_DEFAULT_REGION:-us-east-1}"
[ $# -ge 1 ] || { echo "Uso: $0 <usuario> [--ejecutar]"; exit 1; }
ALUMNO="$1"; MODO="${2:-}"
SLUG="${ALUMNO//./-}"
P="crediflow-${SLUG}-manual"          # nombres con guion (script actual)
PD="crediflow-${ALUMNO}-manual"       # nombres con punto (script antiguo)
CUENTA=$(aws sts get-caller-identity --query Account --output text) || { echo "Sin sesión de AWS"; exit 1; }
EJECUTAR=0; [ "$MODO" = "--ejecutar" ] && EJECUTAR=1
q() { aws "$@" --output text --region "$REGION" 2>/dev/null | tr '\t' '\n' | grep -v '^None$' | grep -v '^$' || true; }
run() { echo "   + aws $*"; if [ $EJECUTAR -eq 1 ]; then aws "$@" --region "$REGION" > /dev/null || echo "     (falló; se continúa)"; fi; }

echo "== Recursos de '$ALUMNO' en la cuenta $CUENTA ($REGION)"
INSTANCIAS=$(q ec2 describe-instances --filters "Name=tag:Name,Values=$P-api,$PD-api" "Name=instance-state-name,Values=pending,running,stopping,stopped" --query 'Reservations[].Instances[].InstanceId')
VPCS=$(q ec2 describe-vpcs --filters "Name=tag:Name,Values=$P-vpc,$PD-vpc" --query 'Vpcs[].VpcId')
DBS=$(q rds describe-db-instances --query "DBInstances[?DBInstanceIdentifier=='$P-db'].DBInstanceIdentifier")
SNAPS=$(q rds describe-db-snapshots --snapshot-type manual --query "DBSnapshots[?DBInstanceIdentifier=='$P-db'].DBSnapshotIdentifier")
SUBGRP=$(q rds describe-db-subnet-groups --query "DBSubnetGroups[?DBSubnetGroupName=='$P-subnets' || DBSubnetGroupName=='$PD-subnets'].DBSubnetGroupName" | sort -u)
SECRETOS=$(q secretsmanager list-secrets --include-planned-deletion --query "SecretList[?Name=='crediflow/$ALUMNO/manual/db' || Name=='crediflow/$SLUG/manual/db'].Name")
# Por prefijo y no por nombre exacto: cubre a quien tenía mal el número de cuenta en su .env. Incluye el bucket de la sesión 1.
BUCKETS=$(aws s3api list-buckets --query "Buckets[?starts_with(Name,'$P-') || starts_with(Name,'$PD-') || starts_with(Name,'crediflow-$ALUMNO-lab1-') || starts_with(Name,'crediflow-$SLUG-lab1-')].Name" --output text 2>/dev/null | tr '\t' '\n' | grep -v '^None$' || true)
ROLES=""; for r in $(printf '%s\n' "$P-ec2-role" "$PD-ec2-role" "crediflow-$ALUMNO-lab1-lector" "crediflow-$SLUG-lab1-lector" | sort -u); do aws iam get-role --role-name "$r" > /dev/null 2>&1 && ROLES="$ROLES $r"; done
PERFILES=""; for r in $(printf '%s\n' "$P-ec2-role" "$PD-ec2-role" | sort -u); do aws iam get-instance-profile --instance-profile-name "$r" > /dev/null 2>&1 && PERFILES="$PERFILES $r"; done
IGWS_SUELTOS=$(q ec2 describe-internet-gateways --filters "Name=tag:Name,Values=$P-igw,$PD-igw" --query 'InternetGateways[?length(Attachments)==`0`].InternetGatewayId')

echo "   EC2:            ${INSTANCIAS:-—}" | tr '\n' ' '; echo
echo "   RDS:            ${DBS:-—}"
echo "   Snapshots:      ${SNAPS:-—}" | tr '\n' ' '; echo
echo "   DB subnet grp:  ${SUBGRP:-—}"
echo "   Secretos:       ${SECRETOS:-—}" | tr '\n' ' '; echo
echo "   Buckets:        ${BUCKETS:-—}" | tr '\n' ' '; echo
echo "   Roles IAM:     ${ROLES:- —}   Instance profiles:${PERFILES:- —}"
echo "   IGW sin VPC:    ${IGWS_SUELTOS:-—}" | tr '\n' ' '; echo
echo "   VPC:            ${VPCS:-—}" | tr '\n' ' '; echo
for v in $VPCS; do
  echo "     $v → subredes: $(q ec2 describe-subnets --filters Name=vpc-id,Values=$v --query 'Subnets[].SubnetId' | wc -l | tr -d ' ')," \
       "security groups: $(q ec2 describe-security-groups --filters Name=vpc-id,Values=$v --query "SecurityGroups[?GroupName!='default'].GroupId" | wc -l | tr -d ' ')," \
       "gateways: $(q ec2 describe-internet-gateways --filters Name=attachment.vpc-id,Values=$v --query 'InternetGateways[].InternetGatewayId' | wc -l | tr -d ' ')"
done
if [ $EJECUTAR -eq 0 ]; then
  echo; echo "Solo se listó. Para BORRAR todo lo anterior (no se puede deshacer):"; echo "   $0 $ALUMNO --ejecutar"; exit 0
fi

echo "== Borrando (orden inverso al de creación)"
for i in $INSTANCIAS; do run ec2 terminate-instances --instance-ids "$i"; done
for i in $INSTANCIAS; do echo "   Esperando a que termine $i..."; aws ec2 wait instance-terminated --instance-ids "$i" --region "$REGION"; done
for PERFIL in $PERFILES; do
  aws iam remove-role-from-instance-profile --instance-profile-name "$PERFIL" --role-name "$PERFIL" > /dev/null 2>&1 || true
  echo "   + aws iam delete-instance-profile $PERFIL"; aws iam delete-instance-profile --instance-profile-name "$PERFIL" || echo "     (falló; se continúa)"
done
for ROL in $ROLES; do
  for pol in $(aws iam list-role-policies --role-name "$ROL" --query 'PolicyNames[]' --output text 2>/dev/null); do aws iam delete-role-policy --role-name "$ROL" --policy-name "$pol"; done
  for arn in $(aws iam list-attached-role-policies --role-name "$ROL" --query 'AttachedPolicies[].PolicyArn' --output text 2>/dev/null); do aws iam detach-role-policy --role-name "$ROL" --policy-arn "$arn"; done
  echo "   + aws iam delete-role $ROL"; aws iam delete-role --role-name "$ROL" || echo "     (falló; se continúa)"
done
for s in $SNAPS; do run rds delete-db-snapshot --db-snapshot-identifier "$s"; done
for d in $DBS; do run rds delete-db-instance --db-instance-identifier "$d" --skip-final-snapshot --delete-automated-backups; done
for d in $DBS; do echo "   Esperando a que RDS elimine $d (unos 5 min)..."; aws rds wait db-instance-deleted --db-instance-identifier "$d" --region "$REGION"; done
for g in $SUBGRP; do run rds delete-db-subnet-group --db-subnet-group-name "$g"; done
for s in $SECRETOS; do run secretsmanager delete-secret --secret-id "$s" --force-delete-without-recovery; done
for b in $BUCKETS; do echo "   + aws s3 rb s3://$b --force"; aws s3 rb "s3://$b" --force --region "$REGION" > /dev/null || echo "     (falló; se continúa)"; done
for v in $VPCS; do
  SGS=$(q ec2 describe-security-groups --filters Name=vpc-id,Values=$v --query "SecurityGroups[?GroupName!='default'].GroupId")
  # Dos pasadas: sg-db referencia a sg-app, así que el primero puede fallar en la primera vuelta.
  for vuelta in 1 2; do for g in $SGS; do aws ec2 delete-security-group --group-id "$g" --region "$REGION" > /dev/null 2>&1 && echo "   + security group $g borrado"; done; done
  for s in $(q ec2 describe-subnets --filters Name=vpc-id,Values=$v --query 'Subnets[].SubnetId'); do run ec2 delete-subnet --subnet-id "$s"; done
  for r in $(q ec2 describe-route-tables --filters Name=vpc-id,Values=$v --query 'RouteTables[?length(Associations[?Main==`true`])==`0`].RouteTableId'); do run ec2 delete-route-table --route-table-id "$r"; done
  for g in $(q ec2 describe-internet-gateways --filters Name=attachment.vpc-id,Values=$v --query 'InternetGateways[].InternetGatewayId'); do
    run ec2 detach-internet-gateway --internet-gateway-id "$g" --vpc-id "$v"; run ec2 delete-internet-gateway --internet-gateway-id "$g"; done
  run ec2 delete-vpc --vpc-id "$v"
done
for g in $IGWS_SUELTOS; do run ec2 delete-internet-gateway --internet-gateway-id "$g"; done
echo "✅ Limpieza de '$ALUMNO' terminada. Comprueba:"
echo "   aws resourcegroupstaggingapi get-resources --tag-filters Key=ManagedBy,Values=manual Key=Student,Values=$ALUMNO --query 'ResourceTagMappingList[].ResourceARN' --region $REGION"
