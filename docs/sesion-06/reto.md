# Sesión 6 · Reto final: una alarma más, con su prueba y su runbook

Opcional. No cuesta nada y no necesita la cuenta de AWS: todo ocurre en tu máquina y en el CI de tu repositorio.

**Objetivo.** Agregar la alarma que le falta a la precalificación y dejarla como se deja el trabajo terminado: en código, probada y documentada.

**Cómo se hace.**

1. En `infra/lib/stacks/observability-stack.ts`, crea una alarma sobre los errores 5xx de API Gateway (la métrica `apigw5xx` ya existe en el archivo): 3 o más en un minuto, con el nombre `alarm-precal-5xx` y una descripción que termine en "Runbook RB-03".
2. Agrégala a `this.alerts.bind(...)` y al widget de estado de alarmas del tablero.
3. En `infra/test/`, escribe una prueba para `ObservabilityStack` que compruebe dos cosas: que el stack tiene 7 alarmas, y que la descripción de todas nombra un runbook. Toma como modelo las pruebas de la sesión 3.
4. En tu runbook, completa RB-03 con el primer paso: "si suena esta alarma, lo primero que miro es…".

**Cómo comprobar que funciona.**

```bash
npm test -w infra
npm run nag
git checkout -b feat/alarma-precal && git add -A && git commit -m "feat: alarma de errores de la precalificación, con prueba"
git push -u origin feat/alarma-precal && gh pr create --fill
```

El CI debe terminar en verde. Con el despliegue desactivado, puedes fusionarlo sin problema.

**Qué entregas.** En el canal del curso: el enlace al pull request con el CI en verde y el paso que agregaste a RB-03. Si usaste IA, cuenta qué le pediste y qué corregiste.

**Bonus.** Haz que la prueba falle a propósito (quita el runbook de una descripción), mira el CI en rojo y vuelve a dejarla bien. Acabas de impedir que alguien, dentro de un año, cree una alarma que nadie sabe atender.
