import React, { useState } from 'react';
import { 
  View, 
  Text, 
  SafeAreaView, 
  TouchableOpacity, 
  Image, 
  ScrollView,
  StatusBar
} from 'react-native';
import { ChevronLeft, Camera, Fuel, Info, CheckCircle2, MapPin, Calendar, Banknote } from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Voucher } from '../constants/mockData';

export default function VoucherDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { voucher } = route.params as { voucher: Voucher };
  const [photoUri, setPhotoUri] = useState<string | null>(voucher.proofUrl || null);

  const handleTakePhoto = () => {
    navigation.navigate('Camera', { voucherId: voucher.id });
  };

  const handleApprove = () => {
    // Simulate approval
    navigation.goBack();
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-slate-950">
      <StatusBar barStyle="dark-content" />
      
      {/* Custom Header */}
      <View className="px-6 py-4 flex-row items-center justify-between">
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-900 items-center justify-center"
        >
          <ChevronLeft size={20} color="#0f172a" />
        </TouchableOpacity>
        <Text className="text-lg font-black text-slate-900 dark:text-white">Détails du Bon</Text>
        <View className="w-10" />
      </View>

      <ScrollView className="flex-1 px-6 pt-4">
        {/* Main Card */}
        <View className="bg-slate-900 p-8 rounded-[3rem] mb-8 shadow-2xl shadow-slate-400 overflow-hidden">
          <View className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16" />
          
          <View className="flex-row justify-between items-start mb-8">
            <View className="p-4 bg-white/10 rounded-2xl">
              <Fuel size={32} color="white" />
            </View>
            <View className="items-end">
              <Text className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-1">Montant</Text>
              <Text className="text-3xl font-black text-white">{voucher.montant} <Text className="text-sm font-bold opacity-50">TND</Text></Text>
            </View>
          </View>

          <View className="space-y-4">
            <View>
              <Text className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-1">Numéro de Bon</Text>
              <Text className="text-xl font-black text-white tracking-tight">{voucher.numBon}</Text>
            </View>
            <View className="flex-row gap-6">
              <View>
                <Text className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-1">Carburant</Text>
                <Text className="text-sm font-bold text-white uppercase">{voucher.typeCarburant}</Text>
              </View>
              <View>
                <Text className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-1">Statut</Text>
                <Text className={`text-sm font-bold ${voucher.status === 'en_attente' ? 'text-blue-400' : 'text-emerald-400'} uppercase`}>
                  {voucher.status === 'en_attente' ? 'En attente' : 'Utilisé'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Info Grid */}
        <View className="space-y-4 mb-8">
          <View className="flex-row items-center p-5 bg-slate-50 dark:bg-slate-900 rounded-3xl">
            <View className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 items-center justify-center">
              <MapPin size={18} color="#64748b" />
            </View>
            <View className="ml-4">
              <Text className="text-[10px] font-bold text-slate-400 uppercase">Véhicule</Text>
              <Text className="text-sm font-bold text-slate-900 dark:text-white">{voucher.vehicule}</Text>
            </View>
          </View>

          <View className="flex-row items-center p-5 bg-slate-50 dark:bg-slate-900 rounded-3xl">
            <View className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 items-center justify-center">
              <Calendar size={18} color="#64748b" />
            </View>
            <View className="ml-4">
              <Text className="text-[10px] font-bold text-slate-400 uppercase">Date d'émission</Text>
              <Text className="text-sm font-bold text-slate-900 dark:text-white">
                {new Date(voucher.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </Text>
            </View>
          </View>
        </View>

        {/* Proof Photo Section */}
        <Text className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 ml-1">Preuve de Consommation</Text>
        
        {photoUri ? (
          <View className="mb-8">
            <Image 
              source={{ uri: photoUri }} 
              className="w-full h-64 rounded-3xl bg-slate-100"
              resizeMode="cover"
            />
            <TouchableOpacity 
              onPress={handleTakePhoto}
              className="absolute top-4 right-4 bg-black/50 p-2 rounded-xl backdrop-blur-md"
            >
              <Camera size={20} color="white" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity 
            onPress={handleTakePhoto}
            activeOpacity={0.7}
            className="w-full h-48 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[2rem] items-center justify-center mb-8 bg-slate-50/50 dark:bg-slate-900/50"
          >
            <View className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 items-center justify-center mb-4">
              <Camera size={24} color="#94a3b8" />
            </View>
            <Text className="text-slate-500 font-bold">Prendre une photo du reçu</Text>
            <Text className="text-slate-400 text-[10px] font-medium mt-1 uppercase">Obligatoire pour validation</Text>
          </TouchableOpacity>
        )}

        {voucher.status === 'en_attente' && (
          <TouchableOpacity 
            disabled={!photoUri}
            onPress={handleApprove}
            className={`h-16 rounded-2xl flex-row items-center justify-center mb-10 shadow-lg ${photoUri ? 'bg-emerald-600 shadow-emerald-200' : 'bg-slate-200 opacity-50'}`}
          >
            <CheckCircle2 size={20} color="white" className="mr-2" />
            <Text className="text-white text-lg font-black ml-2">Valider le Bon</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
