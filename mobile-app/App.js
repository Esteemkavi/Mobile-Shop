import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Image, Linking, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from "react-native";

const RAW = "https://raw.githubusercontent.com/Esteemkavi/Mobile-Shop/main/";
const categories = [
  { key: "iphone", title: "Soft Materials", subtitle: "iPhone" },
  { key: "samsung", title: "Textures Materials", subtitle: "Samsung" },
  { key: "oneplus", title: "Marvel Collections", subtitle: "OnePlus" }
];
const links = {
  phone: "tel:+919876543210",
  whatsapp: "https://wa.me/919876543210?text=Hi%20NextGen%20Mobiles",
  instagram: "https://instagram.com/",
  facebook: "https://facebook.com/",
  youtube: "https://youtube.com/"
};
const imageUrl = p => !p ? null : /^https?:\/\//i.test(p) ? p : RAW + p.replace(/^\//, "");
const price = p => p ? "₹" + p : "Price on enquiry";

function ProductCard({ item, onPress }) {
  return <Pressable onPress={() => onPress(item)} style={styles.card}>
    <Image source={{uri:imageUrl(item.image)}} style={styles.image}/>
    <Text numberOfLines={2} style={styles.name}>{item.name}</Text>
    <Text style={styles.price}>{price(item.price)}</Text>
  </Pressable>;
}
function App() {
  const [catalog,setCatalog]=useState(null), [arrivals,setArrivals]=useState([]), [category,setCategory]=useState("iphone");
  const [search,setSearch]=useState(""), [selected,setSelected]=useState(null), [page,setPage]=useState(1), [error,setError]=useState("");
  useEffect(()=>{ Promise.all([
    fetch(RAW+"skins.json").then(r=>r.json()),
    fetch(RAW+"new_arrivals.json").then(r=>r.json())
  ]).then(([c,a])=>{setCatalog(c);setArrivals(a.new_arrivals||[])}).catch(()=>setError("Could not load the catalog. Check your internet connection.")); },[]);
  const products=useMemo(()=>{
    const all=Object.entries(catalog||{}).flatMap(([cat,items])=>(items||[]).map(x=>({...x,category:cat})));
    return search.trim()?all.filter(x=>x.name.toLowerCase().includes(search.toLowerCase())):(catalog?.[category]||[]).map(x=>({...x,category}));
  },[catalog,category,search]);
  if(selected) return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.detail}>
    <Pressable onPress={()=>setSelected(null)}><Text style={styles.back}>‹ Back</Text></Pressable>
    <Image source={{uri:imageUrl(selected.image)}} style={styles.detailImage} resizeMode="contain"/>
    <Text style={styles.category}>{selected.category.toUpperCase()}</Text><Text style={styles.detailName}>{selected.name}</Text>
    <Text style={styles.detailPrice}>{price(selected.price)}</Text>
    <Text style={styles.desc}>Premium mobile skin from NextGen Mobiles. Contact us for availability, installation and current pricing.</Text>
    <Pressable style={styles.whatsapp} onPress={()=>Linking.openURL("https://wa.me/919876543210?text="+encodeURIComponent("Hi NextGen Mobiles, I am interested in: "+selected.name))}><Text style={styles.whatsappText}>Enquire on WhatsApp</Text></Pressable>
  </ScrollView></SafeAreaView>;
  if(error) return <SafeAreaView style={styles.center}><Text style={styles.error}>{error}</Text></SafeAreaView>;
  if(!catalog) return <SafeAreaView style={styles.center}><ActivityIndicator size="large"/><Text>Loading NextGen Mobiles...</Text></SafeAreaView>;
  const visible=products.slice(0,page*10);
  return <SafeAreaView style={styles.safe}><StatusBar barStyle="light-content" backgroundColor="#222"/>
    <View style={styles.header}><Text style={styles.brand}>NextGen Mobiles</Text><Text style={styles.tagline}>Premium mobile skins</Text>
      <TextInput value={search} onChangeText={v=>{setSearch(v);setPage(1)}} placeholder="Search skins..." placeholderTextColor="#888" style={styles.search}/>
    </View>
    <FlatList data={visible} numColumns={2} keyExtractor={x=>String(x.id)+"-"+x.category} contentContainerStyle={styles.content}
      columnWrapperStyle={styles.row}
      ListHeaderComponent={<View><Text style={styles.section}>Categories</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>
        {categories.map(c=><Pressable key={c.key} onPress={()=>{setCategory(c.key);setSearch("");setPage(1)}} style={styles.cat}><Text style={styles.catIcon}>▣</Text><Text style={styles.catTitle}>{c.title}</Text><Text style={styles.catSub}>{c.subtitle}</Text></Pressable>)}
      </ScrollView><Text style={styles.section}>{search?"Search Results":"Products"}</Text></View>}
      renderItem={({item})=><ProductCard item={item} onPress={setSelected}/>}
      ListEmptyComponent={<Text style={styles.empty}>No skins found.</Text>}
      ListFooterComponent={<View>{visible.length<products.length&&<Pressable style={styles.more} onPress={()=>setPage(page+1)}><Text style={styles.moreText}>Load More</Text></Pressable>}
        <Text style={styles.arrivalTitle}>New Arrivals</Text><FlatList horizontal data={arrivals} keyExtractor={(_,i)=>String(i)} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.arrivals} renderItem={({item})=><Image source={{uri:imageUrl(item.image)}} style={styles.arrival}/>}/>
        <View style={styles.footer}><Text style={styles.footerTitle}>NextGen Mobiles</Text><Text style={styles.footerText}>Pollachi, Tamil Nadu</Text><Text style={styles.footerText}>+91 98765 43210</Text>
          <View style={styles.actions}>{[["Call",links.phone],["WhatsApp",links.whatsapp],["Instagram",links.instagram],["Facebook",links.facebook],["YouTube",links.youtube]].map(([t,u])=><Pressable key={t} style={styles.action} onPress={()=>Linking.openURL(u)}><Text style={styles.actionText}>{t}</Text></Pressable>)}</View>
        </View></View>}
    />
  </SafeAreaView>;
}
const styles=StyleSheet.create({
safe:{flex:1,backgroundColor:"#f0f0f0"},center:{flex:1,alignItems:"center",justifyContent:"center",padding:24,backgroundColor:"#f0f0f0"},error:{fontSize:17,textAlign:"center"},
header:{backgroundColor:"#222",padding:16},brand:{color:"#fff",fontSize:27,fontWeight:"800"},tagline:{color:"#aaa",marginTop:2,marginBottom:12},search:{height:44,backgroundColor:"#fff",borderRadius:10,paddingHorizontal:14},
content:{padding:14,paddingBottom:30},section:{fontSize:22,fontWeight:"800",marginBottom:10,color:"#222"},catRow:{gap:10,paddingBottom:18},cat:{width:150,minHeight:110,backgroundColor:"#fff",borderRadius:14,padding:14,borderWidth:1,borderColor:"#e0e0e0"},catIcon:{fontSize:26,color:"#ff5733"},catTitle:{fontWeight:"800",marginTop:6},catSub:{color:"#777",marginTop:4},row:{justifyContent:"space-between"},
card:{width:"48%",backgroundColor:"#fff",borderRadius:12,padding:8,marginBottom:12,borderWidth:1,borderColor:"#e5e5e5"},image:{width:"100%",aspectRatio:3/4,borderRadius:9,backgroundColor:"#eee"},name:{fontSize:14,fontWeight:"700",marginTop:9,minHeight:36},price:{color:"#ff5733",fontSize:16,fontWeight:"800",marginTop:4},empty:{textAlign:"center",padding:30,color:"#666"},
more:{alignSelf:"center",backgroundColor:"#0078d7",paddingHorizontal:22,paddingVertical:11,borderRadius:9,marginVertical:8},moreText:{color:"#fff",fontWeight:"800"},arrivalTitle:{fontSize:24,fontWeight:"900",color:"#ff5733",marginTop:26,marginBottom:10},arrivals:{gap:10,paddingBottom:18},arrival:{width:150,height:200,borderRadius:10,backgroundColor:"#eee"},
footer:{backgroundColor:"#222",borderRadius:14,padding:18,marginTop:12},footerTitle:{color:"#fff",fontSize:20,fontWeight:"900"},footerText:{color:"#bbb",marginTop:5},actions:{flexDirection:"row",flexWrap:"wrap",gap:8,marginTop:14},action:{backgroundColor:"#fff",paddingHorizontal:12,paddingVertical:9,borderRadius:8},actionText:{fontWeight:"800"},
detail:{padding:16,paddingBottom:40},back:{fontSize:18,fontWeight:"800",marginBottom:8},detailImage:{width:"100%",height:430,backgroundColor:"#fff",borderRadius:14},category:{color:"#777",fontSize:12,fontWeight:"800",marginTop:18,letterSpacing:1},detailName:{fontSize:28,fontWeight:"900",marginTop:6},detailPrice:{color:"#ff5733",fontSize:24,fontWeight:"900",marginTop:10},desc:{color:"#555",fontSize:16,lineHeight:24,marginTop:18},whatsapp:{backgroundColor:"#128c7e",borderRadius:12,padding:15,alignItems:"center",marginTop:24},whatsappText:{color:"#fff",fontWeight:"900",fontSize:16}
});