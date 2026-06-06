alter table island_cells add column if not exists work_kind text;
alter table island_cells add column if not exists work_remaining integer;
alter table island_cells add column if not exists work_total integer;
alter table island_cells add column if not exists work_arg integer;
alter table island_cells add column if not exists monster_kind text;
alter table island_cells add column if not exists monster_action_remaining integer;
alter table island_cells add column if not exists monster_action_total integer;
