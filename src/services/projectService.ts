import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type DocumentData,
} from 'firebase/firestore/lite';
import type { NewProject, Project, ProjectUpdate } from '../models/project';
import { requireFirestore, timestampToDate } from './firestoreHelpers';

function projectsCollection(userId: string) {
  return collection(requireFirestore(), 'users', userId, 'projects');
}

function parseProject(id: string, data: DocumentData): Project {
  if (
    typeof data.name !== 'string' ||
    typeof data.description !== 'string' ||
    typeof data.isActive !== 'boolean'
  ) {
    throw new Error(`Project ${id} has invalid stored data.`);
  }

  return {
    id,
    name: data.name,
    description: data.description,
    isActive: data.isActive,
    createdAt: timestampToDate(data.createdAt),
    updatedAt: timestampToDate(data.updatedAt),
  };
}

export async function getProjects(userId: string): Promise<Project[]> {
  const projectsQuery = query(projectsCollection(userId), orderBy('name'));
  const snapshot = await getDocs(projectsQuery);
  return snapshot.docs.map((project) => parseProject(project.id, project.data()));
}

export async function createProject(userId: string, project: NewProject) {
  const name = project.name.trim();
  if (!name) {
    throw new Error('Enter a project name.');
  }
  if (name.length > 100 || project.description.trim().length > 500) {
    throw new Error('Project names must be at most 100 characters and descriptions at most 500 characters.');
  }

  return addDoc(projectsCollection(userId), {
    name,
    description: project.description.trim(),
    isActive: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateProject(userId: string, projectId: string, updates: ProjectUpdate) {
  const name = updates.name.trim();
  if (!name) {
    throw new Error('Project name cannot be empty.');
  }
  if (name.length > 100 || updates.description.trim().length > 500) {
    throw new Error('Project names must be at most 100 characters and descriptions at most 500 characters.');
  }

  await updateDoc(doc(projectsCollection(userId), projectId), {
    name,
    description: updates.description.trim(),
    isActive: updates.isActive,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteProject(userId: string, projectId: string) {
  await deleteDoc(doc(projectsCollection(userId), projectId));
}
