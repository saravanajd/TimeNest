export type Project = {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export type NewProject = {
  name: string;
  description: string;
};

export type ProjectUpdate = {
  name: string;
  description: string;
  isActive: boolean;
};
