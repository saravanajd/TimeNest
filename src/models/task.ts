export type Task = {
  id: string;
  taskDate: string;
  title: string;
  improvedTitle: string | null;
  projectId: string | null;
  startTime: Date | null;
  endTime: Date | null;
  durationMinutes: number;
  isCompleted: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

export type TaskInput = Pick<Task, 'title' | 'projectId' | 'startTime' | 'endTime'>;
