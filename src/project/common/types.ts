export interface ProjectUserList {
    _id: string,
    projectName: string,
    status: string,
    organizationName: string,
}

export enum CustomFieldType {
  TEXT = 'text',
  NUMBER = 'number',
  DATE = 'date',
}