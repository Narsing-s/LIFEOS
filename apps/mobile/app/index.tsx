import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { apiRequest } from '../src/api';
import { withNetworkError } from '../src/network';

export default function Home() {
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [overview, setOverview] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    SecureStore.getItemAsync('lifeos.token').then(value => {
      if (value) {
        setToken(value);
        void load(value);
      }
    });
  }, []);

  async function load(authToken = token!) {
    setBusy(true);
    setError('');
    try {
      setOverview(await withNetworkError(() => apiRequest('/life/overview', authToken)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load LIFEOS.');
    } finally {
      setBusy(false);
    }
  }

  async function login() {
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await withNetworkError(() => apiRequest('/auth/login', undefined, {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), password }),
      }));
      await SecureStore.setItemAsync('lifeos.token', result.token);
      setToken(result.token);
      await load(result.token);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign in failed.');
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await SecureStore.deleteItemAsync('lifeos.token');
    setToken(null);
    setOverview(null);
    setError('');
  }

  if (!token) {
    return <SafeAreaView style={styles.safe}><View style={styles.auth}>
      <Text style={styles.logo}>LIFEOS</Text>
      <Text style={styles.title}>Your life, connected.</Text>
      <Text style={styles.sub}>Sign in to continue to your personal operating system.</Text>
      <TextInput autoCapitalize="none" autoCorrect={false} keyboardType="email-address" placeholder="Email" placeholderTextColor="#8b95a7" value={email} onChangeText={setEmail} style={styles.input}/>
      <TextInput secureTextEntry autoCapitalize="none" placeholder="Password" placeholderTextColor="#8b95a7" value={password} onChangeText={setPassword} style={styles.input}/>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <Pressable accessibilityRole="button" accessibilityLabel="Sign in" disabled={busy} onPress={login} style={styles.button}>{busy ? <ActivityIndicator color="#fff"/> : <Text style={styles.buttonText}>Sign in</Text>}</Pressable>
    </View></SafeAreaView>;
  }

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.page}>
    <View style={styles.header}><View><Text style={styles.logo}>LIFEOS</Text><Text style={styles.sub}>Everything about your life.</Text></View><Pressable accessibilityRole="button" onPress={logout}><Text style={styles.link}>Sign out</Text></Pressable></View>
    <View style={styles.hero}><Text style={styles.heroTitle}>Life overview</Text><Text style={styles.sub}>Your latest activity, inbox and connected services.</Text><Pressable accessibilityRole="button" disabled={busy} onPress={() => void load()} style={styles.refresh}><Text style={styles.refreshText}>{busy ? 'Refreshing…' : 'Refresh'}</Text></Pressable></View>
    {error ? <View style={styles.errorBox}><Text accessibilityRole="alert" style={styles.error}>{error}</Text><Pressable onPress={() => void load()}><Text style={styles.retry}>Retry</Text></Pressable></View> : null}
    <Section title="Timeline" items={overview?.timeline?.map((x:any) => `${x.title} · ${new Date(x.occurred_at).toLocaleDateString()}`) ?? []}/>
    <Section title="Inbox" items={overview?.inbox?.map((x:any) => x.subject ?? x.title ?? 'Inbox item') ?? []}/>
    <Section title="Connections" items={overview?.connections?.map((x:any) => `${x.provider} · ${x.status}`) ?? []}/>
  </ScrollView></SafeAreaView>;
}

function Section({ title, items }: { title: string; items: string[] }) {
  return <View style={styles.card}><Text style={styles.cardTitle}>{title}</Text>{items.length ? items.slice(0, 6).map((item, i) => <Text key={`${item}-${i}`} style={styles.item}>{item}</Text>) : <Text style={styles.empty}>Nothing here yet.</Text>}</View>;
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:'#f4f6fa'},
  page:{padding:20,gap:16},
  auth:{flex:1,justifyContent:'center',padding:24},
  header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:16},
  logo:{fontSize:24,fontWeight:'800',letterSpacing:1,color:'#172033'},
  title:{fontSize:30,fontWeight:'800',color:'#172033',marginTop:20},
  heroTitle:{fontSize:25,fontWeight:'800',color:'#172033'},
  sub:{color:'#6b7588',marginTop:5,lineHeight:20},
  input:{backgroundColor:'#fff',borderRadius:14,padding:16,marginTop:12,color:'#172033',borderWidth:1,borderColor:'#e1e6ee'},
  button:{backgroundColor:'#172033',padding:16,borderRadius:14,alignItems:'center',marginTop:14},
  buttonText:{color:'#fff',fontWeight:'700'},
  error:{color:'#b42318',marginTop:10},
  errorBox:{backgroundColor:'#fff4f2',borderRadius:14,padding:14},
  retry:{color:'#5067a8',fontWeight:'800',marginTop:8},
  link:{color:'#5067a8',fontWeight:'700'},
  hero:{backgroundColor:'#e9edff',borderRadius:20,padding:20},
  refresh:{alignSelf:'flex-start',marginTop:14,backgroundColor:'#172033',paddingHorizontal:16,paddingVertical:10,borderRadius:10},
  refreshText:{color:'#fff',fontWeight:'700'},
  card:{backgroundColor:'#fff',borderRadius:18,padding:18},
  cardTitle:{fontSize:18,fontWeight:'800',color:'#172033',marginBottom:10},
  item:{paddingVertical:10,color:'#30394b',borderBottomWidth:1,borderBottomColor:'#edf0f4'},
  empty:{color:'#8b95a7'}
});