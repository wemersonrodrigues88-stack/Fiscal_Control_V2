-- Cadastro completo de lojas: endereço estruturado e vencimento mensal do ISS.
ALTER TABLE stores ADD COLUMN address_number TEXT;
ALTER TABLE stores ADD COLUMN complement TEXT;
ALTER TABLE stores ADD COLUMN city TEXT;
ALTER TABLE stores ADD COLUMN iss_due_day INTEGER;
