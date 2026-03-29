import { auth, db } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
  AI_GENERATION = 'ai_generation',
}

export interface ErrorInfo {
  error: string;
  stack?: string;
  type: string;
  context?: any;
  timestamp: any;
  userId?: string;
  userEmail?: string;
}

export const reportErrorToAI = async (error: any, type: string, context?: any) => {
  try {
    const errorData: ErrorInfo = {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      type,
      context,
      timestamp: serverTimestamp(),
      userId: auth.currentUser?.uid,
      userEmail: auth.currentUser?.email || undefined
    };

    console.error(`[AI Error Report - ${type}]:`, errorData);
    
    // Save to Firestore so the AI can query it later
    await addDoc(collection(db, 'system_errors'), errorData);
  } catch (e) {
    console.error("Failed to report error to AI:", e);
  }
};

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null): never => {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  const errorString = JSON.stringify(errInfo);
  console.error('Firestore Error: ', errorString);
  throw new Error(errorString);
};
