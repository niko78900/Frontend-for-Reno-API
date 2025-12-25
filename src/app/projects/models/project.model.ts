export type ContractorExpertise = 'JUNIOR' | 'APPRENTICE' | 'SENIOR';

export type TaskStatus = 'NOT_STARTED' | 'WORKING' | 'FINISHED' | 'CANCELED';

export interface Task {
  id: string;
  projectId: string;
  name: string;
  status: TaskStatus;
  description?: string;
}

export interface Project {
  id: string;
  name: string;
  budget: number;
  finished?: boolean;
  contractor?: string;
  contractorId?: string;
  contractorName?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  progress?: number;
  eta?: number;
  number_of_workers?: number;
  numberOfWorkers?: number;
  taskIds?: string[];
}

export interface Contractor {
  id: string;
  _id?: string;
  fullName: string;
  price: number;
  expertise: ContractorExpertise;
}
