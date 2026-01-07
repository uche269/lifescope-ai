export enum GoalCategory {
  PHYSICAL = 'Physical appearance',
  HEALTH = 'Health, weight & diet',
  SELF_DEV = 'Self development',
  PERSONAL = 'Personal projects',
  WORK = 'Work projects',
  FAMILY = 'Family activities',
  FINANCE = 'Finances',
  RELOCATION = 'Relocation to Canada',
}

export interface Activity {
  id: string;
  name: string;
  isCompleted: boolean;
  frequency: 'Daily' | 'Weekly' | 'Monthly' | 'Once';
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
}

export interface MealPlanPreferences {
  goal: string;
  dietType: string;
  caloriesPerDay?: string;
  allergies?: string;
}