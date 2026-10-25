-- Personalización: letra, fondo y eslogan de cada restaurante
alter table public.restaurantes
  add column if not exists tipografia text not null default 'fonda'
    check (tipografia in ('fonda','bistro','moderna','cantina')),
  add column if not exists fondo text not null default 'crema'
    check (fondo in ('crema','blanco','arena','salvia')),
  add column if not exists eslogan text not null default ''
    check (char_length(eslogan) <= 80);

grant update (tipografia, fondo, eslogan) on public.restaurantes to authenticated;
