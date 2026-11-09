# Instalación del software (semana 0)

Todo el curso se trabaja desde la terminal. Instala lo siguiente **antes de la sesión 1** y verifica con `npm run verify`.

| Herramienta | Versión mínima | Se usa desde |
|---|---|---|
| Git | 2.x | Sesión 1 |
| fnm + Node.js 22 | 22 (`.nvmrc`) | Sesión 1 |
| AWS CLI v2 | **2.32** (necesaria para `aws login`) | Sesión 1 |
| Visual Studio Code (o tu editor) | — | Sesión 1 |
| Session Manager plugin | — | Sesión 2 |
| Docker Desktop | 20+ | Sesión 4 (construir la imagen de la API) |
| GitHub CLI (`gh`) | 2.x | Sesión 3 (opcional, facilita crear el repo) |
| PowerShell 7 (`pwsh`) | 7.x | Solo Windows |

---

## macOS

Instala [Homebrew](https://brew.sh) si no lo tienes y luego:

```bash
brew install git fnm awscli gh
brew install --cask visual-studio-code docker session-manager-plugin
echo 'eval "$(fnm env --use-on-cd --shell zsh)"' >> ~/.zshrc && source ~/.zshrc
fnm install 22 && fnm default 22

# Verificar
git --version && node --version && npm --version && aws --version && docker --version && session-manager-plugin
```

Abre Docker Desktop una vez para que termine de instalarse (sesión 4).

---

## Windows 10/11

Usa [winget](https://learn.microsoft.com/windows/package-manager/) desde **PowerShell como administrador**:

```powershell
winget install --id Git.Git -e
winget install --id Schniz.fnm -e
winget install --id Amazon.AWSCLI -e
winget install --id Microsoft.PowerShell -e
winget install --id Microsoft.VisualStudioCode -e
winget install --id GitHub.cli -e
winget install --id Docker.DockerDesktop -e
```

Session Manager plugin (sesión 2): descarga e instala desde
<https://docs.aws.amazon.com/systems-manager/latest/userguide/install-plugin-windows.html>.

Cierra y vuelve a abrir la terminal (usa **PowerShell 7**, el ícono "pwsh"). Configura fnm e instala Node 22:

```powershell
if (-not (Test-Path $PROFILE)) { New-Item -Path $PROFILE -ItemType File -Force | Out-Null }
Add-Content -Path $PROFILE -Value 'fnm env --use-on-cd --shell powershell | Out-String | Invoke-Expression'
. $PROFILE
fnm install 22; fnm default 22
```

Verifica:

```powershell
git --version; node --version; npm --version; aws --version; docker --version; session-manager-plugin
```

Si PowerShell bloquea la ejecución de scripts `.ps1`:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

Docker Desktop en Windows requiere WSL 2. Si pide activarlo: `wsl --install` y reinicia.

---

## Visual Studio Code: extensiones recomendadas

- ESLint, Prettier
- AWS Toolkit
- Docker
- GitLens

---

## Clonar el repositorio y verificar

```bash
git clone <url-del-repo-base> crediflow
cd crediflow
cp .env.example .env            # Windows: Copy-Item .env.example .env
npm install
npm run verify
```

Resultado esperado: todas las filas con ✅ excepto "Identidad AWS", que se resuelve en la sesión 1 con `aws login` (ver [acceso-aws.md](acceso-aws.md)). Si `aws --version` es menor a 2.32, actualiza la CLI: `aws login` no existe en versiones anteriores.

## Problemas frecuentes

| Síntoma | Causa / solución |
|---|---|
| `aws: command not found` (Mac) | Reabrir la terminal; `brew link awscli` |
| `aws no se reconoce` (Windows) | Reabrir la terminal tras instalar; revisar que `C:\Program Files\Amazon\AWSCLIV2` esté en el PATH |
| `npm ERR! EACCES` (Mac) | No uses `sudo`; con fnm los permisos ya son del usuario |
| `fnm: command not found` | Reabrir la terminal; revisar la línea `fnm env` en `~/.zshrc` o `$PROFILE` |
| `node-gyp` falla en Windows | No afecta: ninguna dependencia del curso compila código nativo |
| Docker "daemon not running" | Abrir Docker Desktop y esperar el ícono verde |
| Scripts `.ps1` bloqueados | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
