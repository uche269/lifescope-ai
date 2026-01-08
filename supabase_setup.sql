-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Create Goals Table
create table public.goals (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  category text not null,
  priority text check (priority in ('High', 'Medium', 'Low')) not null,
  description text,
  progress integer default 0,
  status text check (status in ('Not Started', 'In Progress', 'Completed')) default 'Not Started',
  deadline timestamp with time zone,
  ai_recommendations text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create Activities Table
create table public.activities (
  id uuid default uuid_generate_v4() primary key,
  goal_id uuid references public.goals(id) on delete cascade not null,
  name text not null,
  is_completed boolean default false,
  frequency text check (frequency in ('Daily', 'Weekly', 'Monthly', 'Once')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create Weight Logs Table (already referenced in Health.tsx)
create table public.weight_logs (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null,
  weight numeric not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create Measurements Table (already referenced in Health.tsx)
create table public.measurements (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null,
  arm numeric,
  stomach numeric,
  waist numeric,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create Food Logs Table (already referenced in Health.tsx)
create table public.food_logs (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null,
  time time not null,
  name text not null,
  calories numeric,
  protein numeric,
  carbs numeric,
  fat numeric,
  image text, -- storing base64 or URL
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table public.goals enable row level security;
alter table public.activities enable row level security;
alter table public.weight_logs enable row level security;
alter table public.measurements enable row level security;
alter table public.food_logs enable row level security;

-- Create Policies
-- Goals
create policy "Users can view their own goals" on public.goals for select using (auth.uid() = user_id);
create policy "Users can insert their own goals" on public.goals for insert with check (auth.uid() = user_id);
create policy "Users can update their own goals" on public.goals for update using (auth.uid() = user_id);
create policy "Users can delete their own goals" on public.goals for delete using (auth.uid() = user_id);

-- Activities
create policy "Users can view activities for their goals" on public.activities for select using (
  exists (select 1 from public.goals where public.goals.id = public.activities.goal_id and public.goals.user_id = auth.uid())
);
create policy "Users can insert activities for their goals" on public.activities for insert with check (
  exists (select 1 from public.goals where public.goals.id = public.activities.goal_id and public.goals.user_id = auth.uid())
);
create policy "Users can update activities for their goals" on public.activities for update using (
  exists (select 1 from public.goals where public.goals.id = public.activities.goal_id and public.goals.user_id = auth.uid())
);
create policy "Users can delete activities for their goals" on public.activities for delete using (
  exists (select 1 from public.goals where public.goals.id = public.activities.goal_id and public.goals.user_id = auth.uid())
);

-- Weight/Health/Food Logs
create policy "Users can crud their own weight logs" on public.weight_logs for all using (auth.uid() = user_id);
create policy "Users can crud their own measurements" on public.measurements for all using (auth.uid() = user_id);
create policy "Users can crud their own food logs" on public.food_logs for all using (auth.uid() = user_id);

-- Data Migration (INSERT DUMMY DATA)
-- Note: We need a valid user_id to insert data. 
-- Since we are running this in SQL Editor, we can use auth.uid() if running as authenticated user, 
-- OR we can ask the user to sign up first.
-- For now, this data insertion is a template.

/*
-- Example Data Insertion (You can run this block after you have signed up in the app)

DO $$
DECLARE
  v_user_id uuid;
  v_goal_id_1 uuid;
  v_goal_id_2 uuid;
BEGIN
  -- Build valid user_id logic here, or manually replace with your UUID from Authentication > Users
  -- For now, picking the first user in auth.users
  select id into v_user_id from auth.users limit 1;

  IF v_user_id IS NOT NULL THEN
    -- Goal 1
    insert into public.goals (user_id, title, category, priority, description, progress, status)
    values (v_user_id, 'Lose 5kg by December', 'Health, weight & diet', 'Medium', 'Gym and Diet plan', 65, 'In Progress')
    returning id into v_goal_id_1;

    insert into public.activities (goal_id, name, is_completed, frequency)
    values 
      (v_goal_id_1, 'Morning Cardio', true, 'Daily'),
      (v_goal_id_1, 'No Sugar', false, 'Daily');

    -- Goal 2
    insert into public.goals (user_id, title, category, priority, description, progress, status)
    values (v_user_id, 'Save CAD $15,000', 'Relocation to Canada', 'High', 'Relocation fund', 40, 'In Progress')
    returning id into v_goal_id_2;

    insert into public.activities (goal_id, name, is_completed, frequency)
    values 
      (v_goal_id_2, 'Transfer to FX Account', true, 'Monthly');
  END IF;
END $$;
*/
