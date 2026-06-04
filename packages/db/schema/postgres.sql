create table game_state (
  id text primary key check (id = 'default'),
  turn integer not null,
  last_turn_at bigint not null,
  rules_json jsonb not null
);

create table islands (
  id text primary key,
  name text not null,
  money integer not null,
  food integer not null,
  population integer not null,
  area integer not null,
  score integer not null,
  farm_size integer not null,
  factory_size integer not null,
  mine_size integer not null,
  absent_turns integer not null,
  invalid_command_policy text not null check (invalid_command_policy in ('skip', 'consume'))
);

create table island_cells (
  island_id text not null references islands(id) on delete cascade,
  x integer not null,
  y integer not null,
  terrain text not null,
  value integer not null,
  primary key (island_id, x, y)
);

create table command_queue (
  island_id text not null references islands(id) on delete cascade,
  position integer not null,
  kind text not null,
  x integer not null,
  y integer not null,
  target_island_id text references islands(id) on delete set null,
  arg integer,
  primary key (island_id, position)
);

create table turn_logs (
  id bigserial primary key,
  turn integer not null,
  island_id text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create index island_cells_island_id_idx on island_cells(island_id);
create index command_queue_island_id_idx on command_queue(island_id);
create index turn_logs_turn_idx on turn_logs(turn);
create index turn_logs_island_id_idx on turn_logs(island_id);
