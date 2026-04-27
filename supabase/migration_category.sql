-- Přidání sloupce category do use_cases
ALTER TABLE use_cases ADD COLUMN IF NOT EXISTS category text DEFAULT 'other';

COMMENT ON COLUMN use_cases.category IS 'Povolené hodnoty: images (🖼️ Obrázky), video (🎬 Video), coding (💻 Kódování), chatbot (🤖 Chatbot), text (✍️ Text & Copywriting), audio (🎵 Audio & Hudba), data (📊 Data & Analytika), design (🎨 Design & UI), productivity (🔧 Produktivita), other (🔮 Ostatní)';
