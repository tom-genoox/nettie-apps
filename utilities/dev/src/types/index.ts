export type ProjectType = 'app' | 'frontend' | 'backend';

export interface ProjectConfig {
  name: string;
  description: string;
  githubRepo: string;
  createGithubRepo: boolean;
  githubToken?: string;
}

export interface UtilityConfig extends ProjectConfig {
  type: ProjectType;
}

export interface ProjectAnswers {
  projectType: ProjectType;
  projectName: string;
  description: string;
  githubRepo: string;
  createGithubRepo: boolean;
  githubToken?: string;
} 