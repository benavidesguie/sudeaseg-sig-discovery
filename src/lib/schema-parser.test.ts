import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSchemaFile } from "./schema-parser";

test("CSV con los alias del script universal", () => {
  const csv = [
    "esquema,nombre_tabla,nombre_columna,tipo_dato,permite_nulos,longitud_maxima",
    "ventas,facturas,id,int,NO,",
    "ventas,facturas,numero,varchar,NO,20",
    "ventas,clientes,nombre,nvarchar,YES,-1",
  ].join("\n");
  const r = parseSchemaFile("esquema.csv", csv);
  assert.equal(r.error, undefined);
  assert.equal(r.rows.length, 3);
  assert.deepEqual(r.rows[1], {
    tableSchema: "ventas",
    tableName: "facturas",
    columnName: "numero",
    dataType: "varchar",
    isNullable: "NO",
    charMaxLength: 20,
    ordinal: 2,
  });
  assert.equal(r.rows[2].charMaxLength, null, "SQL Server (MAX) = -1 se guarda como null");
  assert.equal(r.rows[2].ordinal, 1, "el ordinal se reinicia por tabla");
});

test("CSV separado por punto y coma con encabezados INFORMATION_SCHEMA y BOM", () => {
  const csv = "﻿TABLE_SCHEMA;TABLE_NAME;COLUMN_NAME;DATA_TYPE;IS_NULLABLE;CHARACTER_MAXIMUM_LENGTH\ndbo;Orders;OrderID;int;NO;NULL\n";
  const r = parseSchemaFile("export.csv", csv);
  assert.equal(r.error, undefined);
  assert.equal(r.rows[0].tableName, "Orders");
  assert.equal(r.rows[0].charMaxLength, null);
});

test("TSV de mysql -B", () => {
  const tsv = "esquema\tnombre_tabla\tnombre_columna\ttipo_dato\tpermite_nulos\tlongitud_maxima\napp\tusers\temail\tvarchar\tNO\t255\n";
  const r = parseSchemaFile("esquema.tsv", tsv);
  assert.equal(r.rows[0].columnName, "email");
  assert.equal(r.rows[0].charMaxLength, 255);
});

test("JSON (MongoDB / SQL Server FOR JSON)", () => {
  const json = JSON.stringify([
    { esquema: "app", nombre_tabla: "pedidos", nombre_columna: "cliente.id", tipo_dato: "objectid", permite_nulos: "N" },
    { esquema: "app", nombre_tabla: "pedidos", nombre_columna: "total", tipo_dato: "double", permite_nulos: "YES" },
  ]);
  const r = parseSchemaFile("esquema.json", json);
  assert.equal(r.error, undefined);
  assert.equal(r.rows.length, 2);
  assert.equal(r.rows[0].isNullable, "NO");
});

test("encabezados de Oracle ALL_TAB_COLUMNS con Y/N", () => {
  const r = parseSchemaFile("o.json", JSON.stringify({ columns: [{ OWNER: "X", TABLE_NAME: "T", COLUMN_NAME: "C", DATA_TYPE: "NUMBER", NULLABLE: "Y", DATA_LENGTH: 22 }] }));
  assert.equal(r.error, undefined);
  assert.deepEqual([r.rows[0].tableSchema, r.rows[0].isNullable, r.rows[0].charMaxLength], ["X", "YES", 22]);
});

test("omite filas vacías y duplicadas", () => {
  const csv = "nombre_tabla,nombre_columna,tipo_dato\nt,a,int\nt,a,int\n,b,int\n";
  const r = parseSchemaFile("x.csv", csv);
  assert.equal(r.rows.length, 1);
  assert.equal(r.skipped, 2);
});

test("informa columnas obligatorias faltantes", () => {
  const r = parseSchemaFile("x.csv", "foo,bar\n1,2\n");
  assert.match(r.error ?? "", /nombre_tabla/);
  assert.equal(r.rows.length, 0);
});

test("JSON inválido", () => {
  assert.match(parseSchemaFile("x.json", "{no json").error ?? "", /JSON/);
});
