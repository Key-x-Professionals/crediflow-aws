# =============================================================================
# Sesión 2 · Despliegue "artesanal" de CrediFlow con la AWS CLI (Windows / PowerShell)
#
# Uso:   .\scripts\manual\despliegue-manual.ps1 <paso>
# Pasos: red | seguridad | datos | codigo | servidor | verificar | limpiar | todo
#
# Requiere PowerShell 7+ (pwsh). Guarda los IDs en scripts\manual\estado.out
# =============================================================================
param([Parameter(Mandatory = $true)][ValidateSet('red', 'seguridad', 'datos', 'codigo', 'servidor', 'verificar', 'limpiar', 'todo')][string]$Paso)
$ErrorActionPreference = 'Stop'
$env:AWS_PAGER = ''
Set-Location (Join-Path $PSScriptRoot '..\..')

# Cargar .env y estado previo
$estado = 'scripts\manual\estado.out'
if (-not (Test-Path $estado)) { New-Item $estado -ItemType File | Out-Null }
foreach ($f in @('.env', $estado)) {
  Get-Content $f | Where-Object { $_ -match '^\s*[^#].*=' } | ForEach-Object { $k, $v = $_ -split '=', 2; Set-Item "Env:$($k.Trim())" $v.Trim() }
}
$REGION = if ($env:CDK_DEFAULT_REGION) { $env:CDK_DEFAULT_REGION } else { 'us-east-1' }
$P = "crediflow-$($env:CF_STUDENT)-manual"

function Guardar($k, $v) {
  $lines = Get-Content $estado | Where-Object { $_ -notmatch "^$k=" }
  $lines + "$k=$v" | Set-Content $estado
  Set-Item "Env:$k" $v
  Write-Host "   $k=$v"
}
function Tag($id, $name) { aws ec2 create-tags --resources $id --tags "Key=Name,Value=$name" "Key=Student,Value=$($env:CF_STUDENT)" "Key=Project,Value=crediflow" "Key=ManagedBy,Value=manual" --region $REGION }

function Paso-Red {
  Write-Host '== 1. Red: VPC, subredes, internet gateway y rutas'
  $vpc = aws ec2 create-vpc --cidr-block 10.1.0.0/16 --query Vpc.VpcId --output text --region $REGION; Tag $vpc "$P-vpc"; Guardar VPC_ID $vpc
  aws ec2 modify-vpc-attribute --vpc-id $vpc --enable-dns-hostnames --region $REGION
  $az1 = "${REGION}a"; $az2 = "${REGION}b"
  $pub1 = aws ec2 create-subnet --vpc-id $vpc --cidr-block 10.1.0.0/24 --availability-zone $az1 --query Subnet.SubnetId --output text --region $REGION; Tag $pub1 "$P-public-a"; Guardar SUB_PUB1 $pub1
  $pub2 = aws ec2 create-subnet --vpc-id $vpc --cidr-block 10.1.1.0/24 --availability-zone $az2 --query Subnet.SubnetId --output text --region $REGION; Tag $pub2 "$P-public-b"; Guardar SUB_PUB2 $pub2
  $priv1 = aws ec2 create-subnet --vpc-id $vpc --cidr-block 10.1.10.0/24 --availability-zone $az1 --query Subnet.SubnetId --output text --region $REGION; Tag $priv1 "$P-private-a"; Guardar SUB_PRIV1 $priv1
  $priv2 = aws ec2 create-subnet --vpc-id $vpc --cidr-block 10.1.11.0/24 --availability-zone $az2 --query Subnet.SubnetId --output text --region $REGION; Tag $priv2 "$P-private-b"; Guardar SUB_PRIV2 $priv2
  aws ec2 modify-subnet-attribute --subnet-id $pub1 --map-public-ip-on-launch --region $REGION
  $igw = aws ec2 create-internet-gateway --query InternetGateway.InternetGatewayId --output text --region $REGION; Tag $igw "$P-igw"; Guardar IGW_ID $igw
  aws ec2 attach-internet-gateway --internet-gateway-id $igw --vpc-id $vpc --region $REGION
  $rt = aws ec2 create-route-table --vpc-id $vpc --query RouteTable.RouteTableId --output text --region $REGION; Tag $rt "$P-rt-public"; Guardar RT_ID $rt
  aws ec2 create-route --route-table-id $rt --destination-cidr-block 0.0.0.0/0 --gateway-id $igw --region $REGION | Out-Null
  aws ec2 associate-route-table --route-table-id $rt --subnet-id $pub1 --region $REGION | Out-Null
  aws ec2 associate-route-table --route-table-id $rt --subnet-id $pub2 --region $REGION | Out-Null
  Write-Host '✅ Red lista'
}

function Paso-Seguridad {
  Write-Host '== 2. Security groups'
  $cidr = if ($env:CF_ALLOWED_CIDR) { $env:CF_ALLOWED_CIDR } else { '0.0.0.0/0' }
  $sgApp = aws ec2 create-security-group --group-name "$P-sg-app" --description 'CrediFlow API manual' --vpc-id $env:VPC_ID --query GroupId --output text --region $REGION; Tag $sgApp "$P-sg-app"; Guardar SG_APP $sgApp
  aws ec2 authorize-security-group-ingress --group-id $sgApp --protocol tcp --port 80 --cidr $cidr --region $REGION | Out-Null
  $sgDb = aws ec2 create-security-group --group-name "$P-sg-db" --description 'CrediFlow DB manual' --vpc-id $env:VPC_ID --query GroupId --output text --region $REGION; Tag $sgDb "$P-sg-db"; Guardar SG_DB $sgDb
  aws ec2 authorize-security-group-ingress --group-id $sgDb --protocol tcp --port 5432 --source-group $sgApp --region $REGION | Out-Null
  Write-Host '✅ Security groups listos'
}

function Paso-Datos {
  Write-Host '== 3. Datos: bucket S3, secreto y RDS PostgreSQL'
  $bucket = "$P-$($env:CDK_DEFAULT_ACCOUNT)"; Guardar BUCKET $bucket
  if ($REGION -eq 'us-east-1') { aws s3api create-bucket --bucket $bucket --region $REGION | Out-Null }
  else { aws s3api create-bucket --bucket $bucket --region $REGION --create-bucket-configuration "LocationConstraint=$REGION" | Out-Null }
  aws s3api put-public-access-block --bucket $bucket --public-access-block-configuration 'BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true' --region $REGION
  aws s3api put-bucket-encryption --bucket $bucket --server-side-encryption-configuration '{\"Rules\":[{\"ApplyServerSideEncryptionByDefault\":{\"SSEAlgorithm\":\"AES256\"}}]}' --region $REGION

  $dbPass = aws secretsmanager get-random-password --password-length 24 --exclude-punctuation --query RandomPassword --output text --region $REGION
  aws rds create-db-subnet-group --db-subnet-group-name "$P-subnets" --db-subnet-group-description 'CrediFlow manual' --subnet-ids $env:SUB_PRIV1 $env:SUB_PRIV2 --region $REGION | Out-Null
  aws rds create-db-instance --db-instance-identifier "$P-db" --db-instance-class db.t4g.micro --engine postgres --engine-version 16 `
    --master-username crediflow_admin --master-user-password $dbPass --db-name crediflow `
    --allocated-storage 20 --storage-encrypted --no-publicly-accessible --no-multi-az `
    --vpc-security-group-ids $env:SG_DB --db-subnet-group-name "$P-subnets" --backup-retention-period 0 `
    --tags "Key=Student,Value=$($env:CF_STUDENT)" 'Key=Project,Value=crediflow' 'Key=ManagedBy,Value=manual' --region $REGION | Out-Null
  Write-Host '   Esperando a que RDS esté disponible (5-8 min)...'
  aws rds wait db-instance-available --db-instance-identifier "$P-db" --region $REGION
  $dbHost = aws rds describe-db-instances --db-instance-identifier "$P-db" --query 'DBInstances[0].Endpoint.Address' --output text --region $REGION; Guardar DB_HOST $dbHost
  $secret = "crediflow/$($env:CF_STUDENT)/manual/db"; Guardar DB_SECRET $secret
  $json = @{ host = $dbHost; port = 5432; dbname = 'crediflow'; username = 'crediflow_admin'; password = $dbPass } | ConvertTo-Json -Compress
  $tmp = New-TemporaryFile; Set-Content $tmp $json -NoNewline
  aws secretsmanager create-secret --name $secret --secret-string "file://$tmp" --region $REGION | Out-Null
  Remove-Item $tmp
  Write-Host '✅ Datos listos'
}

function Paso-Codigo {
  Write-Host '== 4. Código: empaquetar la API y subirla a S3'
  $zip = 'scripts\manual\api.zip'
  if (Test-Path $zip) { Remove-Item $zip }
  Compress-Archive -Path 'apps\api\package.json', 'apps\api\tsconfig.json', 'apps\api\src' -DestinationPath $zip
  aws s3 cp $zip "s3://$($env:BUCKET)/releases/api.zip" --region $REGION
  Write-Host "✅ Código en s3://$($env:BUCKET)/releases/api.zip"
}

function Paso-Servidor {
  Write-Host '== 5. Servidor: rol IAM, instance profile y EC2 con user data'
  $role = "$P-ec2-role"; Guardar ROLE $role
  $trust = '{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Principal\":{\"Service\":\"ec2.amazonaws.com\"},\"Action\":\"sts:AssumeRole\"}]}'
  aws iam create-role --role-name $role --assume-role-policy-document $trust | Out-Null
  aws iam attach-role-policy --role-name $role --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore
  $policy = @{
    Version = '2012-10-17'
    Statement = @(
      @{ Effect = 'Allow'; Action = @('s3:GetObject', 's3:PutObject', 's3:ListBucket'); Resource = @("arn:aws:s3:::$($env:BUCKET)", "arn:aws:s3:::$($env:BUCKET)/*") },
      @{ Effect = 'Allow'; Action = 'secretsmanager:GetSecretValue'; Resource = "arn:aws:secretsmanager:${REGION}:$($env:CDK_DEFAULT_ACCOUNT):secret:$($env:DB_SECRET)-*" }
    )
  } | ConvertTo-Json -Depth 5
  $tmp = New-TemporaryFile; Set-Content $tmp $policy
  aws iam put-role-policy --role-name $role --policy-name crediflow-minimo --policy-document "file://$tmp"
  Remove-Item $tmp
  aws iam create-instance-profile --instance-profile-name $role | Out-Null
  aws iam add-role-to-instance-profile --instance-profile-name $role --role-name $role
  Write-Host '   Esperando propagación de IAM (10 s)...'; Start-Sleep 10

  $ami = aws ssm get-parameter --name /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64 --query Parameter.Value --output text --region $REGION
  $ud = (Get-Content 'scripts\manual\user-data.sh' -Raw) -replace '__BUCKET__', $env:BUCKET -replace '__DB_SECRET__', $env:DB_SECRET -replace '__REGION__', $REGION -replace '__STUDENT__', $env:CF_STUDENT
  [IO.File]::WriteAllText((Join-Path (Get-Location) 'scripts\manual\user-data.rendered.out'), $ud.Replace("`r`n", "`n"))
  $tags = "ResourceType=instance,Tags=[{Key=Name,Value=$P-api},{Key=Student,Value=$($env:CF_STUDENT)},{Key=Project,Value=crediflow},{Key=ManagedBy,Value=manual}]"
  $instance = aws ec2 run-instances --image-id $ami --instance-type t3.micro --subnet-id $env:SUB_PUB1 --security-group-ids $env:SG_APP `
    --iam-instance-profile "Name=$role" --user-data file://scripts/manual/user-data.rendered.out --associate-public-ip-address `
    --metadata-options HttpTokens=required --tag-specifications $tags `
    --query 'Instances[0].InstanceId' --output text --region $REGION
  Guardar INSTANCE_ID $instance
  aws ec2 wait instance-running --instance-ids $instance --region $REGION
  $ip = aws ec2 describe-instances --instance-ids $instance --query 'Reservations[0].Instances[0].PublicIpAddress' --output text --region $REGION; Guardar PUBLIC_IP $ip
  Write-Host "✅ EC2 arrancando. La API tardará ~2 min en instalarse. URL: http://$ip"
}

function Paso-Verificar {
  Write-Host '== 6. Verificación'
  Write-Host "   Invoke-RestMethod http://$($env:PUBLIC_IP)/health"
  try { Invoke-RestMethod "http://$($env:PUBLIC_IP)/health" -TimeoutSec 5 | ConvertTo-Json } catch { Write-Host '   (todavía no responde, espera un minuto y repite)' }
  Write-Host "   Sesión en el servidor sin SSH:  aws ssm start-session --target $($env:INSTANCE_ID) --region $REGION"
}

function Paso-Limpiar {
  Write-Host '== Limpieza de TODO lo creado a mano'
  $ErrorActionPreference = 'Continue'
  aws ec2 terminate-instances --instance-ids $env:INSTANCE_ID --region $REGION | Out-Null; aws ec2 wait instance-terminated --instance-ids $env:INSTANCE_ID --region $REGION
  aws iam remove-role-from-instance-profile --instance-profile-name $env:ROLE --role-name $env:ROLE
  aws iam delete-instance-profile --instance-profile-name $env:ROLE
  aws iam delete-role-policy --role-name $env:ROLE --policy-name crediflow-minimo
  aws iam detach-role-policy --role-name $env:ROLE --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore
  aws iam delete-role --role-name $env:ROLE
  aws rds delete-db-instance --db-instance-identifier "$P-db" --skip-final-snapshot --delete-automated-backups --region $REGION | Out-Null
  Write-Host '   Esperando a que RDS se elimine (5 min)...'; aws rds wait db-instance-deleted --db-instance-identifier "$P-db" --region $REGION
  aws rds delete-db-subnet-group --db-subnet-group-name "$P-subnets" --region $REGION
  aws secretsmanager delete-secret --secret-id $env:DB_SECRET --force-delete-without-recovery --region $REGION | Out-Null
  aws s3 rm "s3://$($env:BUCKET)" --recursive --region $REGION; aws s3api delete-bucket --bucket $env:BUCKET --region $REGION
  aws ec2 delete-security-group --group-id $env:SG_DB --region $REGION
  aws ec2 delete-security-group --group-id $env:SG_APP --region $REGION
  foreach ($s in @($env:SUB_PUB1, $env:SUB_PUB2, $env:SUB_PRIV1, $env:SUB_PRIV2)) { aws ec2 delete-subnet --subnet-id $s --region $REGION }
  aws ec2 delete-route-table --route-table-id $env:RT_ID --region $REGION
  aws ec2 detach-internet-gateway --internet-gateway-id $env:IGW_ID --vpc-id $env:VPC_ID --region $REGION
  aws ec2 delete-internet-gateway --internet-gateway-id $env:IGW_ID --region $REGION
  aws ec2 delete-vpc --vpc-id $env:VPC_ID --region $REGION
  Remove-Item $estado, 'scripts\manual\api.zip', 'scripts\manual\user-data.rendered.out' -ErrorAction SilentlyContinue
  Write-Host '✅ Limpieza terminada'
}

switch ($Paso) {
  'red' { Paso-Red } 'seguridad' { Paso-Seguridad } 'datos' { Paso-Datos } 'codigo' { Paso-Codigo }
  'servidor' { Paso-Servidor } 'verificar' { Paso-Verificar } 'limpiar' { Paso-Limpiar }
  'todo' { Paso-Red; Paso-Seguridad; Paso-Datos; Paso-Codigo; Paso-Servidor; Paso-Verificar }
}
