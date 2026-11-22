# Sesión 5 · Reto para casa: pruebas límite del motor de precalificación

Opcional. No cuesta nada: todo ocurre en tu máquina y en el CI de tu repositorio. **No hay que encender nada.**

**Objetivo.** Encontrar los bordes de la regla de negocio de la precalificación y dejarlos cubiertos con pruebas automáticas.

**Cómo se hace.**

1. Lee `apps/precalificacion/src/motor.ts` y haz una tabla de casos límite. Algunos para empezar: una relación deuda/ingreso exactamente en 40 %; un ingreso de 399 y uno de 400; plazos de 12 y 13 meses, de 36 y 37, de 60 y 61; deudas mayores que el ingreso; el monto máximo cuando ya no queda capacidad de pago.
2. Para cada caso, decide **antes de ejecutar** qué resultado esperas y por qué.
3. Escribe al menos cinco pruebas nuevas en `apps/precalificacion/src/motor.test.ts`.
4. Si una prueba revela un comportamiento que te parece incorrecto para el negocio, **no cambies la regla**: documenta el caso y tu propuesta.

**Cómo comprobar que funciona.**

```bash
npm test -w apps/precalificacion
git checkout -b test/motor-limites && git add -A && git commit -m "test: casos límite del motor de precalificación"
git push -u origin test/motor-limites && gh pr create --fill
```

El CI de tu pull request debe ejecutar tus pruebas y terminar en verde. **No lo fusiones todavía:** con todo apagado, el despliegue fallaría por falta del rol. Lo fusionarás en la sesión 6, en el bloque E, junto con el trabajo de ese día.

**Qué entregas.** En el canal del curso: tu tabla de casos (entrada, resultado esperado, por qué es un borde), el enlace al pull request con el CI en verde y, si encontraste algo discutible, una frase explicándolo. Si usaste IA (prompt 5.1), cuenta qué le pediste y qué casos descartaste.

**Bonus.** Sustituye la idempotencia hecha a mano del evaluador por la utilidad *Idempotency* de Powertools for AWS Lambda, en una rama aparte, y compara cuántas líneas quedan. Solo código y pruebas locales: no hace falta desplegar.
