import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { toByteArray } from 'base64-js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function getOrdinalSuffix(day) {
  if (day === 1 || day === 21 || day === 31) return 'st';
  if (day === 2 || day === 22) return 'nd';
  if (day === 3 || day === 23) return 'rd';
  return 'th';
}

function formatDate(date) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = date.getDate();
  const suffix = getOrdinalSuffix(day);
  const month = months[date.getMonth()];
  const year = String(date.getFullYear()).slice(-2);
  return `${day}${suffix} ${month}${year}`;
}

const VEHICLE_REGEX = /[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}/;

function extractVehicleNumber(text) {
  const match = text.match(VEHICLE_REGEX);
  return match ? match[0] : null;
}

async function readPdfText(fileUri) {
  try {
    const b64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    // Decode base64 to a latin-1 string using base64-js (Hermes-compatible)
    const bytes = toByteArray(b64);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return binary;
  } catch {
    return '';
  }
}

function buildNewFilename(prefix, vehicleNumber, date) {
  return `${prefix}_${vehicleNumber}_fastag_report_${date}.pdf`;
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function App() {
  const [prefix, setPrefix] = useState('');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);

  // Load saved prefix on mount and request permissions
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem('prefix');
        if (saved !== null) setPrefix(saved);
      } catch { /* ignore */ }

      await MediaLibrary.requestPermissionsAsync();
    })();
  }, []);

  // Persist prefix whenever it changes
  useEffect(() => {
    AsyncStorage.setItem('prefix', prefix).catch(() => {});
  }, [prefix]);

  async function pickFiles() {
    if (!prefix.trim()) {
      Alert.alert('Missing prefix', 'Please enter a prefix before picking files.');
      return;
    }
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      setLoading(true);
      const today = new Date();
      const dateStr = formatDate(today);

      const newEntries = await Promise.all(
        result.assets.map(async (asset) => {
          const originalName = asset.name || 'unknown.pdf';

          // 1. Try filename first
          let vehicleNumber = extractVehicleNumber(originalName);

          // 2. Fall back to PDF content
          if (!vehicleNumber) {
            const text = await readPdfText(asset.uri);
            vehicleNumber = extractVehicleNumber(text);
          }

          const proposed = vehicleNumber
            ? buildNewFilename(prefix.trim(), vehicleNumber, dateStr)
            : '';

          return {
            id: asset.uri + '_' + Date.now() + Math.random(),
            uri: asset.uri,
            originalName,
            newName: proposed,
            vehicleFound: !!vehicleNumber,
          };
        })
      );

      setFiles((prev) => [...prev, ...newEntries]);
      setLoading(false);

      const missing = newEntries.filter((e) => !e.vehicleFound);
      if (missing.length > 0) {
        Alert.alert(
          'Vehicle number not found',
          `Could not extract a vehicle number from:\n${missing
            .map((e) => e.originalName)
            .join('\n')}\n\nPlease edit the proposed name manually.`
        );
      }
    } catch (err) {
      setLoading(false);
      Alert.alert('Error', String(err));
    }
  }

  async function saveFile(item) {
    if (!item.newName.trim()) {
      Alert.alert('Empty filename', 'Please enter a filename before saving.');
      return;
    }
    try {
      const destUri = FileSystem.cacheDirectory + item.newName.trim();
      await FileSystem.copyAsync({ from: item.uri, to: destUri });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(destUri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Save renamed PDF',
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('Saved', `File copied as ${item.newName}`);
      }
    } catch (err) {
      Alert.alert('Save failed', String(err));
    }
  }

  async function renameAll() {
    if (files.length === 0) {
      Alert.alert('No files', 'Pick some PDFs first.');
      return;
    }
    for (const item of files) {
      await saveFile(item);
    }
  }

  function updateNewName(id, value) {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, newName: value } : f))
    );
  }

  function removeFile(id) {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>PDF Renamer</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Prefix input */}
        <View style={styles.card}>
          <Text style={styles.label}>Prefix (e.g. Shubham)</Text>
          <TextInput
            style={styles.input}
            value={prefix}
            onChangeText={setPrefix}
            placeholder="Enter prefix"
            placeholderTextColor="#aaa"
            autoCapitalize="words"
          />
        </View>

        {/* Pick PDFs button */}
        <TouchableOpacity style={styles.btnPrimary} onPress={pickFiles} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>📂  Pick PDFs</Text>
          )}
        </TouchableOpacity>

        {/* File list */}
        {files.map((item) => (
          <View key={item.id} style={styles.fileCard}>
            <View style={styles.fileRow}>
              <Text style={styles.fileLabel}>Original:</Text>
              <Text style={styles.fileOrig} numberOfLines={2}>{item.originalName}</Text>
              <TouchableOpacity onPress={() => removeFile(item.id)} style={styles.removeBtn}>
                <Text style={styles.removeText}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.fileLabel}>New name:</Text>
            <TextInput
              style={[styles.input, styles.newNameInput, !item.vehicleFound && styles.inputWarn]}
              value={item.newName}
              onChangeText={(v) => updateNewName(item.id, v)}
              placeholder="Edit new filename"
              placeholderTextColor="#aaa"
              autoCapitalize="characters"
            />
            <TouchableOpacity
              style={styles.btnSave}
              onPress={() => saveFile(item)}
            >
              <Text style={styles.btnText}>💾  Save</Text>
            </TouchableOpacity>
          </View>
        ))}

        {/* Rename All */}
        {files.length > 1 && (
          <TouchableOpacity style={styles.btnRenameAll} onPress={renameAll}>
            <Text style={styles.btnText}>✅  Rename All ({files.length})</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const BLUE = '#1976D2';
const GREEN = '#388E3C';
const ORANGE = '#F57C00';

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F0F4F8',
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight || 24 : 44,
  },
  header: {
    backgroundColor: BLUE,
    paddingVertical: 16,
    paddingHorizontal: 20,
    elevation: 4,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  scroll: {
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
    elevation: 2,
  },
  label: {
    fontSize: 13,
    color: '#555',
    marginBottom: 6,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#222',
    backgroundColor: '#FAFAFA',
  },
  inputWarn: {
    borderColor: ORANGE,
  },
  btnPrimary: {
    backgroundColor: BLUE,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 18,
    elevation: 3,
  },
  btnSave: {
    backgroundColor: GREEN,
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: 10,
    elevation: 2,
  },
  btnRenameAll: {
    backgroundColor: ORANGE,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 10,
    elevation: 3,
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  fileCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
    elevation: 2,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  fileLabel: {
    fontSize: 12,
    color: '#777',
    fontWeight: '600',
    marginRight: 6,
    marginBottom: 4,
  },
  fileOrig: {
    flex: 1,
    fontSize: 13,
    color: '#333',
  },
  newNameInput: {
    marginTop: 4,
  },
  removeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  removeText: {
    color: '#e53935',
    fontSize: 16,
    fontWeight: '700',
  },
});
