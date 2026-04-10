-- Renombra el valor del enum en PostgreSQL de AREA_COMUN a AREACOMUN
-- para eliminar el guion bajo también a nivel de base de datos.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'TipoEspacio'
      AND e.enumlabel = 'AREA_COMUN'
  ) THEN
    ALTER TYPE "TipoEspacio" RENAME VALUE 'AREA_COMUN' TO 'AREACOMUN';
  END IF;
END $$;
