
import admin from "firebase-admin";
import firebaseAppletConfig from "../../firebase-applet-config.json";

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID || firebaseAppletConfig.projectId;
  console.log("Initializing Firebase Admin with project ID:", projectId);
  admin.initializeApp({
    projectId: projectId,
  });
}

const db = admin.firestore();

export interface Material {
  id?: string;
  userId: string;
  title: string;
  subject?: string;
  grade?: string;
  topic?: string;
  content: string;
  createdAt: admin.firestore.Timestamp | string;
}

export class KnowledgeService {
  private collection = db.collection("knowledge_base");

  async saveMaterial(material: Omit<Material, "id" | "createdAt">): Promise<string> {
    const docRef = await this.collection.add({
      ...material,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return docRef.id;
  }

  async getMaterialById(id: string): Promise<Material | null> {
    const doc = await this.collection.doc(id).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as Material;
  }

  async searchMaterials(query: string, userId: string, limitCount: number = 3): Promise<Material[]> {
    // Simple keyword-based search (MVP)
    // Firestore doesn't support full-text search natively without third-party services.
    // For MVP, we'll fetch materials for the user and filter by title/topic/content.
    // In a real app, we'd use Algolia or vector search.
    
    const snapshot = await this.collection
      .where("userId", "==", userId)
      .orderBy("createdAt", "desc")
      .limit(50) // Fetch some recent ones to filter
      .get();

    const materials = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Material));
    
    if (!query) return materials.slice(0, limitCount);

    const lowerQuery = query.toLowerCase();
    return materials
      .filter(m => 
        m.title.toLowerCase().includes(lowerQuery) || 
        m.topic?.toLowerCase().includes(lowerQuery) || 
        m.content.toLowerCase().includes(lowerQuery)
      )
      .slice(0, limitCount);
  }
}

export const knowledgeService = new KnowledgeService();
