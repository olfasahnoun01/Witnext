import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  KeyboardAvoidingView, 
  Platform, 
  Image,
  SafeAreaView,
  StatusBar
} from 'react-native';
import { LogIn, Lock, Mail, ChevronRight } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigation = useNavigation<any>();

  const handleLogin = () => {
    // Simple mock login
    navigation.navigate('Main');
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-slate-950">
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 px-8 justify-center"
      >
        <View className="items-center mb-12">
          <View className="w-24 h-24 bg-slate-900 rounded-3xl items-center justify-center shadow-xl shadow-slate-400 mb-6">
            <LogIn size={40} color="white" />
          </View>
          <Text className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Grosafe Driver</Text>
          <Text className="text-slate-500 dark:text-slate-400 font-medium mt-2">Connectez-vous pour gérer vos bons</Text>
        </View>

        <View className="space-y-6">
          <View>
            <Text className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 ml-1">Adresse Email</Text>
            <View className="flex-row items-center bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl px-4 h-14">
              <Mail size={20} color="#94a3b8" />
              <TextInput 
                className="flex-1 ml-3 text-slate-900 dark:text-white font-semibold"
                placeholder="nom@exemple.com"
                placeholderTextColor="#94a3b8"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>

          <View className="mt-4">
            <Text className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 ml-1">Mot de Passe</Text>
            <View className="flex-row items-center bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl px-4 h-14">
              <Lock size={20} color="#94a3b8" />
              <TextInput 
                className="flex-1 ml-3 text-slate-900 dark:text-white font-semibold"
                placeholder="••••••••"
                placeholderTextColor="#94a3b8"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>
          </View>

          <TouchableOpacity 
            activeOpacity={0.8}
            onPress={handleLogin}
            className="bg-slate-900 dark:bg-blue-600 h-16 rounded-2xl flex-row items-center justify-center mt-8 shadow-lg shadow-slate-300 dark:shadow-blue-900"
          >
            <Text className="text-white text-lg font-black mr-2">Se Connecter</Text>
            <ChevronRight size={20} color="white" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity className="mt-8 items-center">
          <Text className="text-slate-400 dark:text-slate-500 font-bold text-xs uppercase tracking-widest">Mot de passe oublié ?</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
