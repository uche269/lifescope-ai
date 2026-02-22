export const DefaultGoalCategories = {} as const;

export type GoalCategory = string;

export interface GoalCategoryItem {
  id: string;
  name: string;
  color: string;
  is_default: boolean;
}

export interface Activity {
  id: string;
  name: string;
  isCompleted: boolean;
  frequency: 'Daily' | 'Weekly' | 'Monthly' | 'Once';
  last_completed_at?: string; // ISO Date string
  deadline?: string;
}

export interface Goal {
  id: string;
  title: string;
  category: GoalCategory;
  priority: 'High' | 'Medium' | 'Low';
  description: string;
  progress: number; // 0 to 100
  activities: Activity[];
  status: 'Not Started' | 'In Progress' | 'Completed';
  linked_module?: 'finance_savings' | 'health_weight' | null;
  linked_target_value?: number | null;
  target?: number; // fallback/legacy
  deadline?: string;
  aiRecommendations?: string;
}

export interface Message {
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

export interface WeeklyBrief {
  type: 'Sports' | 'History' | 'Finance';
  content: string;
  dateGenerated: string;
}

export interface Project {
  id: string;
  name: string;
  type: 'Personal' | 'Work';
  tasks: { id: string; name: string; status: 'Pending' | 'Done'; deadline?: string }[];
  progress: number;
}

// --- Health Module Types ---

export interface WeightLog {
  id: string;
  date: string;
  weight: number;
}

export interface BodyMeasurement {
  id: string;
  date: string;
  arm: number;
  stomach: number;
  waist: number;
}

export interface FoodLog {
  id: string;
  date: string;
  time: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  image?: string; // base64 string
  confidence?: "high" | "medium" | "low";
  items_json?: string; // stringified JSON array of items
  notes?: string;
}

export interface MealPlanPreferences {
  goal: string;
  dietType: string;
  caloriesPerDay?: string;
  allergies?: string;
  country?: string;
  ethnicGroup?: string;
  duration?: string;
}