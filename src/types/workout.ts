export type UserRole = 'superadmin' | 'usuario';

export interface ManagedUser {
  id: string;
  nombre: string;
  password: string;
  rol: UserRole;
  assignedPlanIds: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkoutPlan {
  id: string;
  nombre: string;
  ejercicios: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkoutEntry {
  id: string;
  usuario: string;
  fecha: string; // YYYY-MM-DD
  ejercicio: string;
  serie: number;
  repeticiones: number;
  peso: number; // kg
  createdAt?: string;
}

export interface WorkoutFormInput {
  usuario: string;
  fecha: string;
  ejercicio: string;
  serie: number;
  repeticiones: number;
  peso: number;
}

export interface UserWeeklyComparison {
  usuario: string;
  seriesSemanaActual: number;
  seriesSemanaAnterior: number;
  cambioSeriesPct: number | null;
}
