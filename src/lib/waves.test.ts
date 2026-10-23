import { test } from "node:test";
import assert from "node:assert/strict";
import { computeWave } from "./waves";

test("Oleada 1: criticidad ALTA con acceso directo", () => {
  for (const accessLevel of ["TOTAL", "DB_ONLY", "API_ONLY"]) {
    assert.equal(computeWave({ kpiCriticality: "ALTA", accessLevel }), 1);
  }
});

test("Oleada 2: ALTA restringida por proveedor o MEDIA con acceso directo", () => {
  assert.equal(computeWave({ kpiCriticality: "ALTA", accessLevel: "RESTRICTED_VENDOR" }), 2);
  assert.equal(computeWave({ kpiCriticality: "ALTA", accessLevel: "MANUAL_EXPORT" }), 2);
  assert.equal(computeWave({ kpiCriticality: "MEDIA", accessLevel: "DB_ONLY" }), 2);
});

test("Oleada 3: criticidad BAJA o patrón Tipo D, aunque sea crítico", () => {
  assert.equal(computeWave({ kpiCriticality: "BAJA", accessLevel: "TOTAL" }), 3);
  assert.equal(computeWave({ kpiCriticality: "BAJA" }), 3);
  assert.equal(
    computeWave({ kpiCriticality: "ALTA", accessLevel: "TOTAL", integrationPattern: "TYPE_D_CONTROLLED_MANUAL" }),
    3,
  );
  assert.equal(computeWave({ kpiCriticality: "MEDIA", accessLevel: "RESTRICTED_VENDOR" }), 3);
});

test("sin criticidad o acceso no se clasifica", () => {
  assert.equal(computeWave({}), null);
  assert.equal(computeWave({ kpiCriticality: "ALTA" }), null);
  assert.equal(computeWave({ accessLevel: "TOTAL" }), null);
});
