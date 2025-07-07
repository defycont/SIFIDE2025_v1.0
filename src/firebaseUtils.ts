import { db, auth as firebaseAuthModule } from './firebaseConfig'; // Firestore instance and auth module
import { AppConfig, IngresosMensual, EgresosMensual, ResicoPfMensual, TaxpayerData, UserProfile, StoredRfcInfo } from './types';
import { INITIAL_INGRESOS, INITIAL_EGRESOS, INITIAL_RESICO_PF, DEFAULT_APP_CONFIG } from './constants';

// Default data structure for a new taxpayer (RFC)
export const getDefaultTaxpayerData = (rfc: string, nombreEmpresa?: string): TaxpayerData => ({
  appConfig: { ...DEFAULT_APP_CONFIG, rfc, nombreEmpresa: nombreEmpresa || `Empresa de ${rfc}` },
  ingresosData: [...INITIAL_INGRESOS.map(item => ({...item}))], // Deep copy
  egresosData: [...INITIAL_EGRESOS.map(item => ({...item}))],   // Deep copy
  resicoPfData: [...INITIAL_RESICO_PF.map(item => ({...item}))], // Deep copy
  lastSavedTimestamp: new Date().toISOString(),
});


const getTaxpayerDocumentRef = (rfc: string) => {
  if (!db) {
    console.error("Firestore (db) is not initialized.");
    throw new Error("Firestore not initialized");
  }
  if (!rfc || rfc.trim() === "") {
    console.error("RFC/userId is empty or invalid.");
    throw new Error("Invalid RFC for Firestore document.");
  }
  return db.collection('taxpayerData').doc(rfc.toUpperCase());
};

const getUserProfileDocumentRef = (authUserId: string) => {
  if (!db) {
    console.error("Firestore (db) is not initialized.");
    throw new Error("Firestore not initialized");
  }
  return db.collection('userProfiles').doc(authUserId);
};


// Fetch all data for a specific Taxpayer (RFC)
export const getFullTaxpayerData = async (rfc: string): Promise<TaxpayerData> => {
  if (!rfc || rfc.trim() === "") {
    console.warn("getFullTaxpayerData called with empty RFC, returning default structure.");
    return getDefaultTaxpayerData(DEFAULT_APP_CONFIG.rfc);
  }
  try {
    const docRef = getTaxpayerDocumentRef(rfc);
    const docSnap = await docRef.get();
    if (docSnap.exists) {
      return docSnap.data() as TaxpayerData;
    } else {
      // Document doesn't exist for this RFC, initialize it with defaults for this RFC
      const newTaxpayerData = getDefaultTaxpayerData(rfc);
      await docRef.set(newTaxpayerData);
      console.log(`New taxpayer document created for RFC ${rfc} with default data.`);
      return newTaxpayerData;
    }
  } catch (error) {
    console.error(`Error getting all taxpayer data for RFC ${rfc}:`, error);
    return getDefaultTaxpayerData(rfc); // Return defaults for this RFC on error
  }
};

// Save all data for a specific Taxpayer (RFC)
export const saveFullTaxpayerData = async (rfc: string, data: TaxpayerData): Promise<void> => {
  if (!rfc || rfc.trim() === "") {
    console.error("saveFullTaxpayerData called with empty RFC. Data not saved.");
    throw new Error("Invalid RFC for saving data.");
  }
  try {
    const docRef = getTaxpayerDocumentRef(rfc);
    const dataToSave = {
      ...data,
      appConfig: {...data.appConfig, rfc: rfc.toUpperCase()}, // Ensure RFC in appConfig matches document ID
      lastSavedTimestamp: new Date().toISOString()
    };
    await docRef.set(dataToSave, { merge: true }); // Merge to avoid overwriting unrelated fields if any
  } catch (error) {
    console.error(`Error setting full taxpayer data for RFC ${rfc}:`, error);
    throw error; // Re-throw to be caught by caller for UI feedback
  }
};

// Update specific fields of TaxpayerData for a given RFC
export const updateTaxpayerPartialData = async (
  rfc: string,
  dataToUpdate: Partial<TaxpayerData>
): Promise<void> => {
  if (!rfc || rfc.trim() === "") {
    console.error("updateTaxpayerPartialData called with empty RFC. Data not saved.");
    throw new Error("Invalid RFC for updating partial data.");
  }
  if (Object.keys(dataToUpdate).length === 0) {
    console.warn("updateTaxpayerPartialData called with no data to update.");
    return;
  }
  try {
    const docRef = getTaxpayerDocumentRef(rfc);
    await docRef.update({
      ...dataToUpdate,
      lastSavedTimestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error(`Error updating partial taxpayer data for RFC ${rfc}:`, error);
    throw error;
  }
};


// Reset data for a specific Taxpayer (RFC) in Firestore to defaults
export const resetTaxpayerFirestoreData = async (rfc: string): Promise<TaxpayerData> => {
  if (!rfc || rfc.trim() === "") {
    console.error("resetTaxpayerFirestoreData called with empty RFC.");
    throw new Error("Invalid RFC for resetting data.");
  }
  try {
    const docRef = getTaxpayerDocumentRef(rfc);
    const defaultDataForRfc = getDefaultTaxpayerData(rfc, DEFAULT_APP_CONFIG.nombreEmpresa); // Use initial default name
    await docRef.set(defaultDataForRfc);
    console.log(`Taxpayer data reset in Firestore for RFC ${rfc}`);
    return defaultDataForRfc;
  } catch (error) {
    console.error(`Error resetting taxpayer data in Firestore for RFC ${rfc}:`, error);
    throw error;
  }
};


// Get a specific field (like lastSavedTimestamp) from a taxpayer's document
export const getSpecificTaxpayerField = async <K extends keyof TaxpayerData>(rfc: string, key: K): Promise<TaxpayerData[K] | undefined> => {
    if (!rfc || rfc.trim() === "") return undefined;
    try {
        const docRef = getTaxpayerDocumentRef(rfc);
        const doc = await docRef.get();
        if (doc.exists) {
            const data = doc.data() as TaxpayerData;
            return data[key];
        }
        return undefined;
    } catch (error) {
        console.error(`Error getting specific field ${String(key)} for RFC ${rfc}:`, error);
        return undefined;
    }
};

// User Profile specific functions
export const getUserProfile = async (authUserId: string): Promise<UserProfile | null> => {
  if (!authUserId) return null;
  try {
    const docRef = getUserProfileDocumentRef(authUserId);
    const docSnap = await docRef.get();
    if (docSnap.exists) {
      return docSnap.data() as UserProfile;
    }
    // Create profile if it doesn't exist, e.g., on first login after auth creation
    const currentUser = firebaseAuthModule.currentUser;
    if (currentUser && currentUser.email) {
        const newUserProfile: UserProfile = { email: currentUser.email };
        await docRef.set(newUserProfile);
        return newUserProfile;
    }
    return null;
  } catch (error) {
    console.error(`Error getting user profile for user ${authUserId}:`, error);
    return null;
  }
};

export const updateUserProfile = async (authUserId: string, data: Partial<UserProfile>): Promise<void> => {
  if (!authUserId) return;
  try {
    const docRef = getUserProfileDocumentRef(authUserId);
    await docRef.set(data, { merge: true });
  } catch (error) {
    console.error(`Error updating user profile for user ${authUserId}:`, error);
    throw error;
  }
};

// Fetch all stored RFCs and their company names
export const getAllStoredRfcs = async (): Promise<StoredRfcInfo[]> => {
  if (!db) {
    console.error("Firestore (db) is not initialized. Cannot fetch RFC list.");
    return [];
  }
  try {
    const snapshot = await db.collection('taxpayerData').get();
    const rfcs: StoredRfcInfo[] = [];
    snapshot.forEach((doc: any) => {
      const data = doc.data() as TaxpayerData;
      rfcs.push({
        rfc: doc.id,
        nombreEmpresa: data.appConfig?.nombreEmpresa || 'Nombre no disponible'
      });
    });
    return rfcs.sort((a,b) => a.nombreEmpresa.localeCompare(b.nombreEmpresa)); // Sort alphabetically by company name
  } catch (error) {
    console.error("Error fetching all stored RFCs:", error);
    return [];
  }
};