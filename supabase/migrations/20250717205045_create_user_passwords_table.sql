create table user_passwords (
  id uuid references auth.users not null,
  password text,
  primary key (id)
);
