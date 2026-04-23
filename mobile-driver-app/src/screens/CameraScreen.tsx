import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, StatusBar } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { X, Zap, ZapOff, Camera as CameraIcon, RefreshCcw } from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

export default function CameraScreen() {
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [flash, setFlash] = useState<'off' | 'on'>('off');
  const [permission, requestPermission] = useCameraPermissions();
  const navigation = useNavigation<any>();
  const cameraRef = useRef<any>(null);

  if (!permission) {
    // Camera permissions are still loading.
    return <View />;
  }

  if (!permission.granted) {
    // Camera permissions are not granted yet.
    return (
      <View className="flex-1 justify-center items-center px-8 bg-white">
        <Text className="text-center text-slate-600 mb-6 font-medium">Nous avons besoin de votre permission pour utiliser la caméra</Text>
        <TouchableOpacity 
          onPress={requestPermission}
          className="bg-slate-900 px-8 py-4 rounded-2xl"
        >
          <Text className="text-white font-bold">Accorder la permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const toggleCameraFacing = () => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  const toggleFlash = () => {
    setFlash(current => (current === 'off' ? 'on' : 'off'));
  };

  const takePicture = async () => {
    if (cameraRef.current) {
      const photo = await cameraRef.current.takePictureAsync();
      navigation.navigate('VoucherDetail', { photoUri: photo.uri });
    }
  };

  return (
    <View className="flex-1 bg-black">
      <StatusBar barStyle="light-content" />
      <CameraView 
        style={{ flex: 1 }} 
        facing={facing} 
        flash={flash}
        ref={cameraRef}
      >
        <SafeAreaView className="flex-1 justify-between">
          {/* Header Controls */}
          <View className="flex-row justify-between px-6 py-4">
            <TouchableOpacity 
              onPress={() => navigation.goBack()}
              className="w-12 h-12 rounded-full bg-black/30 items-center justify-center blur-sm"
            >
              <X color="white" size={24} />
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={toggleFlash}
              className="w-12 h-12 rounded-full bg-black/30 items-center justify-center"
            >
              {flash === 'on' ? <Zap color="#fbbf24" size={24} /> : <ZapOff color="white" size={24} />}
            </TouchableOpacity>
          </View>

          {/* Guide Overlay */}
          <View className="items-center justify-center">
            <View className="w-72 h-48 border-2 border-white/50 rounded-3xl" />
            <Text className="text-white font-bold text-center mt-6 shadow-md">Cadrez le reçu dans le rectangle</Text>
          </View>

          {/* Bottom Controls */}
          <View className="flex-row items-center justify-evenly pb-12">
            <TouchableOpacity 
              onPress={toggleCameraFacing}
              className="w-14 h-14 rounded-full bg-white/20 items-center justify-center"
            >
              <RefreshCcw color="white" size={24} />
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={takePicture}
              activeOpacity={0.8}
              className="w-20 h-20 rounded-full bg-white items-center justify-center p-1"
            >
              <View className="w-full h-full rounded-full border-4 border-slate-900 items-center justify-center">
                <CameraIcon color="#0f172a" size={32} />
              </View>
            </TouchableOpacity>

            <View className="w-14" />
          </View>
        </SafeAreaView>
      </CameraView>
    </View>
  );
}
