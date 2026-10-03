-- Extended palette and type/spacing scale edited by the Theme Builder.
ALTER TABLE "themes"
  ADD COLUMN IF NOT EXISTS "success_color" TEXT,
  ADD COLUMN IF NOT EXISTS "warning_color" TEXT,
  ADD COLUMN IF NOT EXISTS "error_color" TEXT,
  ADD COLUMN IF NOT EXISTS "info_color" TEXT,
  ADD COLUMN IF NOT EXISTS "surface_color" TEXT,
  ADD COLUMN IF NOT EXISTS "font_size" INTEGER NOT NULL DEFAULT 16,
  ADD COLUMN IF NOT EXISTS "spacing" INTEGER NOT NULL DEFAULT 4;
