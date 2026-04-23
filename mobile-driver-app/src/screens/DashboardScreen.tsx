import React from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  SafeAreaView, 
  Image,
  StatusBar
} from 'react-native';
import { Fuel, MapPin, Calendar, ChevronRight, User, Bell } from 'lucide-react-native';
import { MOCK_USER, MOCK_VOUCHERS, Voucher } from '../constants/mockData';
import { useNavigation } from '@react-navigation/native';

export default function DashboardScreen() {
  const navigation = useNavigation<any>();
  const pendingVouchers = MOCK_VOUCHERS.filter(v => v.status === 'en_attente');

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-950">
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <View className="px-6 py-4 flex-row items-center justify-between bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
        <View className="flex-row items-center">
          <Image 
            source={{ uri: MOCK_USER.avatar }} 
            className="w-12 h-12 rounded-2xl bg-slate-100"
          />
          <View className="ml-4">
            <Text className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Bonjour,</Text>
            <Text className="text-lg font-black text-slate-900 dark:text-white leading-tight">{MOCK_USER.fullName}</Text>
          </View>
        </View>
        <TouchableOpacity className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 items-center justify-center">
          <Bell size={20} color="#64748b" />
          <View className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white dark:border-slate-800" />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 px-6 pt-6" showsVerticalScrollIndicator={false}>
        {/* Quick Stats */}
        <View className="flex-row gap-4 mb-8">
          <View className="flex-1 bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
            <Text className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-2">Bons en attente</Text>
            <Text className="text-3xl font-black text-slate-900 dark:text-white">{pendingVouchers.length}</Text>
          </View>
          <View className="flex-1 bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
            <Text className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-2">Total Jour (TND)</Text>
            <Text className="text-3xl font-black text-emerald-600">230</Text>
          </View>
        </View>

        <Text className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 ml-1">Assignations du jour</Text>

        <View className="space-y-4 pb-10">
          {MOCK_VOUCHERS.map((voucher) => (
            <TouchableOpacity 
              key={voucher.id}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('VoucherDetail', { voucher })}
              className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm"
            >
              <View className="flex-row justify-between items-start mb-4">
                <View className="flex-row items-center">
                  <View className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 items-center justify-center">
                    <Fuel size={20} color={voucher.status === 'en_attente' ? '#3b82f6' : '#10b981'} />
                  </View>
                  <View className="ml-3">
                    <Text className="text-sm font-black text-slate-900 dark:text-white">{voucher.numBon}</Text>
                    <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      {voucher.typeCarburant} • {voucher.montant} TND
                    </Text>
                  </View>
                </View>
                <View className={`px-2 py-1 rounded-lg ${voucher.status === 'en_attente' ? 'bg-blue-50 dark:bg-blue-500/10' : 'bg-emerald-50 dark:bg-emerald-500/10'}`}>
                  <Text className={`text-[9px] font-bold uppercase tracking-wider ${voucher.status === 'en_attente' ? 'text-blue-600' : 'text-emerald-600'}`}>
                    {voucher.status === 'en_attente' ? 'À traiter' : 'Validé'}
                  </Text>
                </View>
              </View>

              <View className="space-y-2 mb-4">
                <View className="flex-row items-center">
                  <MapPin size={12} color="#94a3b8" />
                  <Text className="ml-2 text-xs font-semibold text-slate-500 dark:text-slate-400">{voucher.vehicule}</Text>
                </View>
                <View className="flex-row items-center">
                  <Calendar size={12} color="#94a3b8" />
                  <Text className="ml-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {new Date(voucher.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                  </Text>
                </View>
              </View>

              <View className="flex-row items-center justify-between pt-4 border-t border-slate-50 dark:border-slate-800">
                <Text className="text-[10px] font-bold text-slate-300 dark:text-slate-600 uppercase">Appuyez pour voir les détails</Text>
                <ChevronRight size={16} color="#cbd5e1" />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
