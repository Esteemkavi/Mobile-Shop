import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, BackHandler, Image, Linking, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, StatusBar } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useAudioPlayer } from "expo-audio";
import { Image as CachedImage } from "expo-image";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./lib/supabase";

const RAW = "https://raw.githubusercontent.com/Esteemkavi/Mobile-Shop/main/";
const SOCIAL_ICONS = {
  instagram: RAW + "assets/instagram.png",
  facebook: RAW + "assets/facebook.png",
  youtube: RAW + "assets/youtube.png"
};
const PHONE = "8807382243";
const DISPLAY_PHONE = "88073 82243";
const WHATSAPP = `https://wa.me/91${PHONE}`;
const C = { ink:"#080808", gold:"#F5B82E", orange:"#E66A22", cream:"#FFF7E8", paper:"#F5F2EC", muted:"#77736C", line:"#E4DED4", green:"#19A463", white:"#FFFFFF" };

const categories = [
  { key:"mobile-skins", title:"Mobile Skins", subtitle:"Premium Skin Collections", icon:"◆", catalog:true },
  { key:"screen-guard", title:"Screen Guard", subtitle:"Premium Screen Protection", icon:"◇", catalog:false },
  { key:"tempered-glass", title:"Unbreakable Tempered Glass", subtitle:"Premium Protection", icon:"◇", catalog:false },
  { key:"smartphones", title:"Smartphones", subtitle:"Sales & Latest Models", icon:"▣", catalog:false }
];

const imageUrl = p => !p ? null : /^https?:\/\//i.test(p) ? p : RAW + p.replace(/^\//,"");
const price = p => p ? "₹"+p : "Price on enquiry";
const CachedRemoteImage = props => <CachedImage cachePolicy="memory-disk" {...props}/>;
const LIKED_PRODUCTS_STORAGE_KEY = "nextgen.liked-products.v1";
const getLikedProductsStorageKey = guestId => `${LIKED_PRODUCTS_STORAGE_KEY}.${guestId}`;
const GUEST_SESSION_STORAGE_KEY = "nextgen.guest-session.v2";
const isValidGuestContact = value => {
  const contact = String(value || "").trim();
  if (contact.includes("@")) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact);
  return /^[\d\s()+.-]+$/.test(contact) && contact.replace(/\D/g, "").length >= 7 && contact.replace(/\D/g, "").length <= 15;
};
const getProductLikeKey = item => {
  const id = String(item?.id ?? "");
  return id.startsWith("skin-") || id.startsWith("smartphone-") ? id : `product-${id}`;
};
const listStorageFiles = async (bucket, prefix="", depth=0) => {
  if (depth > 5) return [];
  const { data, error } = await supabase.storage.from(bucket).list(prefix, {
    limit: 1000,
    sortBy: { column: "name", order: "asc" },
  });
  if (error) return [];
  const files = [];
  for (const entry of data || []) {
    if (!entry.name || entry.name.startsWith(".")) continue;
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.id == null && entry.metadata == null) {
      files.push(...await listStorageFiles(bucket, path, depth + 1));
    } else {
      files.push({ name: entry.name, path });
    }
  }
  return files;
};
const SMARTPHONE_IMAGE_FILES = Array.from({ length: 11 }, (_, index) =>
  `IMG-20260927-WA${String(index + 24).padStart(4, "0")}.jpg`
);
const matchesStoragePath = (image, path) => {
  try {
    return decodeURIComponent(String(image || "").split("?")[0]).toLowerCase().endsWith(path.toLowerCase());
  } catch {
    return String(image || "").toLowerCase().endsWith(path.toLowerCase());
  }
};

function Logo({dark=false,large=false}){return <View style={S.logoWrap}><Image source={require("./assets/nextgen-logo.png")} style={[S.logoImage,large&&S.logoImageLarge]} resizeMode="contain"/><View><Text style={[S.logoText,dark&&S.logoTextDark,large&&S.logoTextLarge]}>NEXTGEN MOBILES</Text><Text style={[S.logoSub,dark&&S.logoSubDark,large&&S.logoSubLarge]}>MOBILE SKINS • SALES • SERVICE</Text></View></View>;}
function LikeButton({liked,count,likeCount,onPress,style}){const displayCount=count??likeCount??0;const scale=useRef(new Animated.Value(1)).current;const handlePress=event=>{event?.stopPropagation?.();Animated.sequence([Animated.spring(scale,{toValue:1.28,useNativeDriver:false,speed:24,bounciness:9}),Animated.spring(scale,{toValue:1,useNativeDriver:false,speed:20,bounciness:8})]).start();onPress?.();};return <Pressable accessibilityRole="button" accessibilityLabel={`${liked?"Unlike":"Like"} product, ${displayCount} likes`} onPress={handlePress} style={[S.likeButton,style]}><Animated.Text style={[S.likeIcon,liked&&S.likeIconActive,{transform:[{scale}]}]}>{liked?"♥":"♡"}</Animated.Text><Text style={S.likeCount}>{displayCount}</Text></Pressable>;}
function ProductCard({item,onPress,liked,likeCount,onToggleLike}){return <Pressable onPress={()=>onPress(item)} style={({pressed})=>[S.card,pressed&&S.pressed]}><View style={S.cardImageWrap}><CachedRemoteImage source={{uri:imageUrl(item.image)}} style={S.image}/><View style={S.badge}><Text style={S.badgeText}>{item.category==="smartphones"?"PHONE":"SKIN"}</Text></View><LikeButton liked={liked} count={likeCount} onPress={onToggleLike} style={S.imageLikeButton}/></View><Text numberOfLines={2} style={S.name}>{item.name}</Text>{item.category==="smartphones"&&item.price!=null&&<Text style={S.cardPrice}>{price(item.price)}</Text>}<View style={S.cardBottom}><Pressable style={S.cardEnquire} onPress={()=>Linking.openURL(`${WHATSAPP}?text=${encodeURIComponent("Hi NextGen Mobiles, I am interested in: "+item.name)}`)}><Text style={S.cardEnquireText}>Enquire on WhatsApp</Text></Pressable><Text style={S.arrow}>›</Text></View></Pressable>;}
function NavItem({icon,label,active,onPress}){return <Pressable onPress={onPress} style={S.navItem}><Text style={[S.navIcon,active&&S.active]}>{icon}</Text><Text style={[S.navLabel,active&&S.active]}>{label}</Text></Pressable>;}
function ContactBlock(){return <View style={S.footer}><Text style={S.footerEyebrow}>NEXTGEN MOBILES</Text><Text style={S.footerTitle}>Need help choosing a skin?</Text><Text style={S.footerText}>Call or WhatsApp us for availability, pricing and installation.</Text><Pressable style={S.footerButton} onPress={()=>Linking.openURL(`${WHATSAPP}?text=${encodeURIComponent("Hi NextGen Mobiles, I need help choosing a mobile skin.")}`)}><Text style={S.footerButtonText}>Chat on WhatsApp  ›</Text></Pressable></View>;}

function AppContent(){
 const welcomeAudioPlayer=useAudioPlayer(require("./assets/welcome-audio.wav"));
 const [catalog,setCatalog]=useState(null),[arrivals,setArrivals]=useState([]),[category,setCategory]=useState("mobile-skins"),[search,setSearch]=useState(""),[selected,setSelected]=useState(null),[page,setPage]=useState(1),[tab,setTab]=useState("home"),[error,setError]=useState(""),[refreshKey,setRefreshKey]=useState(0),[refreshing,setRefreshing]=useState(false),[likedProductKeys,setLikedProductKeys]=useState(new Set()),[likeCounts,setLikeCounts]=useState({}),[likeSaveMessage,setLikeSaveMessage]=useState(""),[profileMenuOpen,setProfileMenuOpen]=useState(false),[profileError,setProfileError]=useState("");
 const [imageViewerOpen,setImageViewerOpen]=useState(false),[zoomScale,setZoomScale]=useState(1),[zoomOffset,setZoomOffset]=useState({x:0,y:0});
 const [guestChecked,setGuestChecked]=useState(false),[guest,setGuest]=useState(null),[guestFirstName,setGuestFirstName]=useState(""),[guestLastName,setGuestLastName]=useState(""),[guestContact,setGuestContact]=useState(""),[guestSaving,setGuestSaving]=useState(false),[guestError,setGuestError]=useState("");
 const refreshSequence=useRef(0),refreshCycle=useRef(null),likedProductKeysRef=useRef(new Set()),pendingLikeKeysRef=useRef(new Set()),likeKeyRevisionRef=useRef(new Map()),storageWriteRef=useRef(Promise.resolve()),zoomScaleRef=useRef(1),zoomGestureRef=useRef({distance:0,startScale:1,startX:0,startY:0,startOffsetX:0,startOffsetY:0}),tabHistoryRef=useRef([]),tabRef=useRef("home"),guestIdRef=useRef(null);
 const navigateToTab=nextTab=>{if(tabRef.current===nextTab)return;tabHistoryRef.current.push(tabRef.current);tabRef.current=nextTab;setTab(nextTab);};
 const goBackScreen=()=>{const previous=tabHistoryRef.current.pop()||"home";tabRef.current=previous;setTab(previous);};
 useEffect(()=>{const subscription=BackHandler.addEventListener("hardwareBackPress",()=>{if(profileMenuOpen){setProfileMenuOpen(false);return true;}if(imageViewerOpen){setImageViewerOpen(false);return true;}if(selected){setSelected(null);return true;}if(tabHistoryRef.current.length>0||tab!=="home"){goBackScreen();return true;}return false;});return()=>subscription.remove();},[profileMenuOpen,imageViewerOpen,selected,tab]);
 const resetImageZoom=()=>{zoomScaleRef.current=1;setZoomScale(1);setZoomOffset({x:0,y:0});};
 const openImageViewer=()=>{resetImageZoom();setImageViewerOpen(true);};
 const handleZoomTouchStart=event=>{
   const touches=event.nativeEvent.touches||[];
   if(touches.length>=2){const [a,b]=touches;zoomGestureRef.current={...zoomGestureRef.current,distance:Math.hypot(a.pageX-b.pageX,a.pageY-b.pageY),startScale:zoomScaleRef.current};}
   else if(touches.length===1){const touch=touches[0];zoomGestureRef.current={...zoomGestureRef.current,startX:touch.pageX,startY:touch.pageY,startOffsetX:zoomOffset.x,startOffsetY:zoomOffset.y};}
 };
 const handleZoomTouchMove=event=>{
   const touches=event.nativeEvent.touches||[];
   if(touches.length>=2){const [a,b]=touches,distance=Math.hypot(a.pageX-b.pageX,a.pageY-b.pageY),start=zoomGestureRef.current;if(start.distance>0){const next=Math.max(1,Math.min(4,start.startScale*distance/start.distance));zoomScaleRef.current=next;setZoomScale(next);if(next===1)setZoomOffset({x:0,y:0});}}
   else if(touches.length===1&&zoomScaleRef.current>1){const touch=touches[0],start=zoomGestureRef.current;setZoomOffset({x:start.startOffsetX+touch.pageX-start.startX,y:start.startOffsetY+touch.pageY-start.startY});}
 };
 const finishRefresh=key=>{if(refreshCycle.current?.key!==key)return;refreshCycle.current.remaining-=1;if(refreshCycle.current.remaining===0){refreshCycle.current=null;setRefreshing(false);}};
 const refreshData=()=>{if(!guest)return;const key=++refreshSequence.current;refreshCycle.current={key,remaining:3};setError("");setRefreshing(true);setRefreshKey(key);};
 const exploreAsGuest=async()=>{
   const firstName=guestFirstName.trim(),lastName=guestLastName.trim(),contact=guestContact.trim();
   if(!firstName||!lastName||!contact){setGuestError("Please enter your first name, last name, and email or phone number.");return;}
   if(!isValidGuestContact(contact)){setGuestError("Enter a valid email address or phone number.");return;}
   try{welcomeAudioPlayer.seekTo(0);welcomeAudioPlayer.play();}
   catch(audioError){console.warn("Welcome audio could not be played.",audioError);}
   setGuestSaving(true);setGuestError("");
   try{
     const {data,error}=await supabase.rpc("create_guest_user",{p_first_name:firstName,p_last_name:lastName,p_contact:contact});
     if(error)throw error;
     if(!data)throw new Error("Guest ID was not returned.");
     const session={id:String(data),firstName,lastName,contact};
     guestIdRef.current=session.id;
     setGuest(session);
     setGuestChecked(true);
     try{await AsyncStorage.setItem(GUEST_SESSION_STORAGE_KEY,JSON.stringify(session));}
     catch(storageError){console.warn("Could not save the guest session on this device.",storageError);}
   }catch(createError){
     console.warn("Could not create guest profile.",createError);
     setGuestError("Could not continue right now. Please check your connection and try again.");
   }finally{setGuestSaving(false);}
 };
 const persistLikedKeys=guestId=>{if(!guestId)return Promise.resolve();const savedKeys=[...likedProductKeysRef.current];storageWriteRef.current=storageWriteRef.current.catch(()=>{}).then(()=>AsyncStorage.setItem(getLikedProductsStorageKey(guestId),JSON.stringify(savedKeys)));return storageWriteRef.current;};
 const toggleProductLike=async item=>{
   if(!guestIdRef.current)return;
   const ownerGuestId=guestIdRef.current;
   const key=getProductLikeKey(item);
   if(!key||key==="product-"||pendingLikeKeysRef.current.has(key))return;
   const wasLiked=likedProductKeysRef.current.has(key),delta=wasLiked?-1:1;
   pendingLikeKeysRef.current.add(key);
   likeKeyRevisionRef.current.set(key,(likeKeyRevisionRef.current.get(key)||0)+1);
   const next=new Set(likedProductKeysRef.current);
   if(wasLiked)next.delete(key);else next.add(key);
   likedProductKeysRef.current=next;setLikedProductKeys(next);
   setLikeCounts(previous=>({...previous,[key]:Math.max(0,(previous[key]||0)+delta)}));
   try{
     await persistLikedKeys(ownerGuestId);
     const {data,error}=await supabase.rpc("adjust_product_like_count",{p_product_key:key,p_delta:delta});
     if(error)throw error;
     setLikeCounts(previous=>({...previous,[key]:Number(data)}));
     setLikeSaveMessage("");
   }catch(likeError){
     if(guestIdRef.current===ownerGuestId){
       const restored=new Set(likedProductKeysRef.current);
       if(wasLiked)restored.add(key);else restored.delete(key);
       likedProductKeysRef.current=restored;setLikedProductKeys(restored);
       persistLikedKeys(ownerGuestId).catch(()=>{});
       setLikeSaveMessage("Like count could not be saved. Check that the Product Likes SQL setup has been run in Supabase.");
     }
     setLikeCounts(previous=>({...previous,[key]:Math.max(0,(previous[key]||0)-delta)}));
     console.warn("Could not save this like. Confirm the product likes SQL setup is applied.",likeError);
   }finally{pendingLikeKeysRef.current.delete(key);}
 };
 const likePropsFor=item=>{const key=getProductLikeKey(item);return{liked:likedProductKeys.has(key),likeCount:likeCounts[key]||0,onToggleLike:()=>toggleProductLike(item)};};
 const logoutGuest=async()=>{
   setProfileError("");
   try{await AsyncStorage.removeItem(GUEST_SESSION_STORAGE_KEY);}
   catch(logoutError){console.warn("Could not clear the guest session.",logoutError);setProfileError("Could not log out. Please try again.");return;}
   guestIdRef.current=null;
   likedProductKeysRef.current=new Set();
   setLikedProductKeys(new Set());
   setGuest(null);
   setGuestFirstName("");setGuestLastName("");setGuestContact("");
   setSelected(null);setImageViewerOpen(false);resetImageZoom();
   tabHistoryRef.current=[];tabRef.current="home";setTab("home");
   setError("");setLikeSaveMessage("");setProfileMenuOpen(false);
 };
 useEffect(()=>{let active=true;AsyncStorage.getItem(GUEST_SESSION_STORAGE_KEY).then(raw=>{if(!active)return;if(raw){const saved=JSON.parse(raw);if(saved?.id&&saved?.firstName&&saved?.lastName&&saved?.contact){guestIdRef.current=String(saved.id);setGuest(saved);}}}).catch(()=>{}).finally(()=>{if(active)setGuestChecked(true);});return()=>{active=false;}},[]);
 useEffect(()=>{let active=true;if(!guest?.id){likedProductKeysRef.current=new Set();setLikedProductKeys(new Set());return()=>{active=false;};}AsyncStorage.getItem(getLikedProductsStorageKey(guest.id)).then(raw=>{if(!active||!raw)return;const loaded=new Set(JSON.parse(raw));likedProductKeysRef.current=loaded;setLikedProductKeys(loaded);}).catch(()=>{});return()=>{active=false;}},[guest?.id]);
useEffect(() => {
  if(!guest)return;
  const loadSkinImages = async () => {
    const { data, error } = await supabase.storage
      .from("skins_products")
      .list("", {
        limit: 100,
        sortBy: { column: "name", order: "asc" },
      });

    if (error) {
      setError("Could not load skin images.");
      return;
    }

    const skinProducts = (data || [])
      .filter((file) => file.name && !file.name.startsWith("."))
      .map((file, index) => ({
        id: `skin-${file.name}`,
        name: `Mobile Skin ${index + 1}`,
        image: supabase.storage
          .from("skins_products")
          .getPublicUrl(file.name).data.publicUrl,
      }));

    setCatalog((prev) => ({
      ...prev,
      "mobile-skins": skinProducts,
    }));
  };

  loadSkinImages().finally(()=>finishRefresh(refreshKey));
}, [refreshKey,guest?.id]);
useEffect(() => {
  if(!guest)return;
  const loadProducts = async () => {
    const { data, error } = await supabase
      .from("products")
      .select(`
        id,
        name,
        image_url,
        price,
        description,
        is_new_arrival,
        categories (
          slug,
          name
        )
      `)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) {
      setError("Could not load the catalog. Check your internet connection.");
      return;
    }

    const groupedCatalog = {};

    (data || []).forEach((product) => {
      const slug = product.categories?.slug;

      if (!slug) return;

      if (!groupedCatalog[slug]) {
        groupedCatalog[slug] = [];
      }

      groupedCatalog[slug].push({
        id: product.id,
        name: product.name,
        image: product.image_url,
        price: product.price,
        description: product.description,
      });
    });

const smartphoneRows = groupedCatalog.smartphones || [];
    const listedSmartphoneFiles = await listStorageFiles("Product_images");
    const smartphoneFilesByPath = new Map(
      SMARTPHONE_IMAGE_FILES.map((name) => [name, { name, path: name }])
    );
    listedSmartphoneFiles.forEach((file) => smartphoneFilesByPath.set(file.path, file));
    const matchedSmartphoneIds = new Set();
    const storageSmartphones = [...smartphoneFilesByPath.values()].map((file) => {
      const matchingProduct = smartphoneRows.find((product) => matchesStoragePath(product.image, file.path));
      if (matchingProduct) matchedSmartphoneIds.add(matchingProduct.id);
      return {
        id: matchingProduct?.id || `smartphone-${file.path}`,
        name: matchingProduct?.name || file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "),
        image: matchingProduct?.image || supabase.storage.from("Product_images").getPublicUrl(file.path).data.publicUrl,
        price: matchingProduct?.price ?? null,
        description: matchingProduct?.description,
      };
    });
    groupedCatalog.smartphones = [
      ...storageSmartphones,
      ...smartphoneRows.filter((product) => !matchedSmartphoneIds.has(product.id)),
    ];

    setCatalog((prev) => ({
      ...groupedCatalog,
      "mobile-skins":
        prev?.["mobile-skins"] || groupedCatalog["mobile-skins"] || [],
    }));

    setArrivals(
      (data || [])
        .filter((product) => product.is_new_arrival)
        .map((product) => ({
          id: product.id,
          image: product.image_url,
          name: product.name,
        }))
    );
  };

  loadProducts().finally(()=>finishRefresh(refreshKey));
}, [refreshKey,guest?.id]);
useEffect(()=>{
  if(!guest)return;
  const loadLikeCounts=async()=>{
    const revisionsAtStart=new Map(likeKeyRevisionRef.current);
    const pendingAtStart=new Set(pendingLikeKeysRef.current);
    const {data,error}=await supabase.from("product_like_counts").select("product_key,like_count");
    if(error)return;
    const loaded=Object.fromEntries((data||[]).map(row=>[row.product_key,Number(row.like_count)||0]));
    setLikeCounts(previous=>{
      new Set([...pendingAtStart,...pendingLikeKeysRef.current]).forEach(key=>{if(key in previous)loaded[key]=previous[key];});
      likeKeyRevisionRef.current.forEach((revision,key)=>{if(revision>(revisionsAtStart.get(key)||0)&&key in previous)loaded[key]=previous[key];});
      return loaded;
    });
  };
  loadLikeCounts().finally(()=>finishRefresh(refreshKey));
},[refreshKey,guest?.id]);
 const products=useMemo(()=>{const all=Object.entries(catalog||{}).flatMap(([cat,items])=>(items||[]).map(x=>({...x,category:cat})));if(search.trim()){const q=search.toLowerCase();return all.filter(x=>String(x.name||"").toLowerCase().includes(q));}return (catalog?.[category]||[]).map(x=>({...x,category}));},[catalog,category,search]);
 const activeCategory=categories.find(c=>c.key===category)||categories[0];
 if(!guestChecked)return <View style={S.guestRoot}><StatusBar barStyle="dark-content"/><Image source={require("./assets/nextgen-logo.png")} style={S.guestLogo} resizeMode="contain"/><ActivityIndicator size="small" color={C.orange}/></View>;
 if(!guest)return <View style={S.guestRoot}><StatusBar barStyle="dark-content"/><View style={S.guestCard}><Image source={require("./assets/nextgen-logo.png")} style={S.guestLogo} resizeMode="contain"/><Text style={S.guestTitle}>Welcome to NextGen Mobiles</Text><Text style={S.guestSubtitle}>Enter your details to explore our latest products.</Text><TextInput value={guestFirstName} onChangeText={setGuestFirstName} placeholder="First name" placeholderTextColor="#8C877F" style={S.guestInput} autoCapitalize="words" autoComplete="given-name" returnKeyType="next" maxLength={60}/><TextInput value={guestLastName} onChangeText={setGuestLastName} placeholder="Last name" placeholderTextColor="#8C877F" style={S.guestInput} autoCapitalize="words" autoComplete="family-name" returnKeyType="next" maxLength={60}/><TextInput value={guestContact} onChangeText={setGuestContact} placeholder="Email or phone number" placeholderTextColor="#8C877F" style={S.guestInput} autoCapitalize="none" autoCorrect={false} returnKeyType="done" maxLength={120} onSubmitEditing={exploreAsGuest}/>{guestError? <Text style={S.guestError}>{guestError}</Text>:null}<Pressable disabled={guestSaving} style={[S.guestButton,guestSaving&&S.guestButtonDisabled]} onPress={exploreAsGuest}>{guestSaving?<ActivityIndicator color={C.white}/>:<Text style={S.guestButtonText}>Explore</Text>}</Pressable></View><Text style={S.guestFooter}>MOBILE SKINS  •  SALES  •  SERVICE</Text></View>;
 if(selected)return <View style={S.root}><StatusBar barStyle="light-content" hidden={false} translucent={false} backgroundColor="#171717" /><SafeAreaView style={S.safe} edges={["top","bottom"]}><ScrollView contentContainerStyle={S.detail} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshData} tintColor={C.orange} colors={[C.orange]}/> }><Pressable onPress={()=>setSelected(null)}><Text style={S.back}>‹  Back</Text></Pressable><View style={S.detailImageWrap}><Pressable accessibilityRole="button" accessibilityLabel="Open image zoom" onPress={openImageViewer} style={S.detailImageTap}><CachedRemoteImage source={{uri:imageUrl(selected.image)}} style={S.detailImage} resizeMode="contain"/></Pressable>{selected.category!=="new arrivals"&&<LikeButton {...likePropsFor(selected)} onPress={()=>toggleProductLike(selected)} style={S.detailLikeButton}/>}</View>{likeSaveMessage?<Text style={S.likeSaveError}>{likeSaveMessage}</Text>:null}<Text style={S.category}>{String(selected.category).toUpperCase()}</Text><Text style={S.detailName}>{selected.name}</Text>{selected.category==="smartphones"&&selected.price!=null&&<Text style={S.detailPrice}>{price(selected.price)}</Text>}<View style={S.infoBox}><Text style={S.infoTitle}>{selected.category==="smartphones"?"Smartphone Details":"Premium Mobile Skin"}</Text><Text style={S.desc}>Ask us about availability, installation, customization and the latest price.</Text></View><Pressable style={S.whatsapp} onPress={()=>Linking.openURL(`${WHATSAPP}?text=${encodeURIComponent("Hi NextGen Mobiles, I am interested in: "+selected.name)}`)}><Text style={S.whatsappText}>◉  Enquire on WhatsApp</Text></Pressable><Pressable style={S.callButton} onPress={()=>Linking.openURL(`tel:+91${PHONE}`)}><Text style={S.callText}>☎  Call {DISPLAY_PHONE}</Text></Pressable></ScrollView><Modal visible={imageViewerOpen} animationType="fade" statusBarTranslucent onRequestClose={()=>setImageViewerOpen(false)}><SafeAreaView style={S.zoomSafe} edges={["top","bottom"]}><Pressable accessibilityRole="button" accessibilityLabel="Close image zoom" style={S.zoomClose} onPress={()=>setImageViewerOpen(false)}><Text style={S.zoomCloseText}>×</Text></Pressable><View style={S.zoomGestureArea} onTouchStart={handleZoomTouchStart} onTouchMove={handleZoomTouchMove}><CachedRemoteImage source={{uri:imageUrl(selected.image)}} style={[S.zoomImage,{transform:[{translateX:zoomOffset.x},{translateY:zoomOffset.y},{scale:zoomScale}]}]} resizeMode="contain"/></View><Text style={S.zoomHint}>Pinch to zoom • Drag to move</Text></SafeAreaView></Modal></SafeAreaView></View>;
 if(error)return <ScrollView contentContainerStyle={S.center} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshData} tintColor={C.orange} colors={[C.orange]}/>}><Text style={S.error}>{error}</Text></ScrollView>;
 if(!catalog)return <ScrollView contentContainerStyle={S.center} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshData} tintColor={C.orange} colors={[C.orange]}/>}><ActivityIndicator size="large"/><Text style={S.loading}>Loading NextGen Mobiles...</Text></ScrollView>;
 const visible=products.slice(0,page*8);
 const grid=<>{visible.length===0?<Text style={S.empty}>No skins found.</Text>:<View style={S.grid}>{visible.map(item=><ProductCard key={String(item.id)+"-"+item.category} item={item} onPress={setSelected} {...likePropsFor(item)}/>)}</View>}{visible.length<products.length&&<Pressable style={S.more} onPress={()=>setPage(p=>p+1)}><Text style={S.moreText}>Load More Products</Text></Pressable>}</>;
 const homeCategoryItems=[categories.find(c=>c.key==="smartphones"),categories.find(c=>c.key==="mobile-skins"),categories.find(c=>c.key==="tempered-glass"),categories.find(c=>c.key==="screen-guard")].filter(Boolean);
 const home=<ScrollView contentContainerStyle={S.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshData} tintColor={C.orange} colors={[C.orange]}/>}><View style={S.homeLogoWrap}><Image source={require("./assets/nextgen-logo.png")} style={S.homeLogo} resizeMode="contain"/></View><View style={S.sectionRow}><View><Text style={S.section}>New Arrivals</Text><Text style={S.hint}>Our latest skin designs and collections</Text></View></View><View style={S.arrivalsScroller}><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.arrivals}>{arrivals.length?arrivals.map((item,i)=><View key={String(i)} style={S.arrivalSlide}><Pressable onPress={()=>setSelected({...item,category:"new arrivals"})}><CachedRemoteImage source={{uri:imageUrl(item.image)}} style={S.arrival}/></Pressable></View>):<Text style={S.empty}>No new arrivals right now.</Text>}</ScrollView><LinearGradient pointerEvents="none" colors={["rgba(245,242,236,0)","rgba(245,242,236,0.96)"]} start={{x:0,y:0.5}} end={{x:1,y:0.5}} style={S.arrivalsScrollShadow}/></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.homeCategories}>{homeCategoryItems.map((c,index)=><Pressable key={c.key} onPress={()=>{setCategory(c.key);setSearch("");setPage(1);navigateToTab("categories");}} style={S.homeCategory}><View style={[S.homeCategoryIcon,index===0&&S.homeCategoryIconBlue,index===1&&S.homeCategoryIconPink,index===2&&S.homeCategoryIconMint,index===3&&S.homeCategoryIconCream]}><Text style={S.homeCategoryGlyph}>{c.icon}</Text></View><Text style={S.homeCategoryTitle}>{c.key==="tempered-glass"?"Tempered Glass":c.key==="screen-guard"?"Accessories":c.title}</Text></Pressable>)}</ScrollView><View style={S.sectionRow}><View><Text style={S.section}>{search?"Search Results":"Featured Skins"}</Text><Text style={S.hint}>{search?products.length+" matches":"Fresh styles for your phone"}</Text></View><Pressable onPress={()=>navigateToTab("categories")}><Text style={S.viewAll}>View all</Text></Pressable></View><TextInput value={search} onChangeText={v=>{setSearch(v);setPage(1)}} placeholder="Search skins..." placeholderTextColor="#8C877F" style={S.search}/>{grid}<ContactBlock/></ScrollView>;
 const categoriesScreen=<ScrollView contentContainerStyle={S.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshData} tintColor={C.orange} colors={[C.orange]}/>}><Text style={S.pageTitle}>Collections</Text><Text style={S.pageSub}>Browse our mobile skin and screen protection collections</Text><View style={S.categoryList}>{categories.map(c=><Pressable key={c.key} onPress={()=>{setCategory(c.key);setSearch("");setPage(1)}} style={[S.categoryLarge,category===c.key&&S.categoryLargeActive]}><View style={S.categoryLargeIcon}><Text style={S.catIconText}>{c.icon}</Text></View><View style={S.categoryCopy}><Text style={S.categoryTitle}>{c.title}</Text><Text style={S.categorySub}>{c.subtitle}</Text></View><Text style={S.categoryArrow}>›</Text></Pressable>)}</View><View style={S.sectionRow}><View><Text style={S.section}>{activeCategory.title}</Text><Text style={S.hint}>{activeCategory.catalog||category==="smartphones"?products.length+" products":"Available at our store"}</Text></View></View><TextInput value={search} onChangeText={v=>{setSearch(v);setPage(1)}} placeholder="Search this collection..." placeholderTextColor="#8C877F" style={S.search}/>{activeCategory.catalog||category==="smartphones"?grid:<View style={S.categoryInfo}><Text style={S.categoryInfoIcon}>{activeCategory.icon}</Text><Text style={S.categoryInfoTitle}>{activeCategory.title}</Text><Text style={S.categoryInfoText}>Explore our {activeCategory.title.toLowerCase()} collection at NextGen Mobiles. Contact us for current availability, models and pricing.</Text><Pressable style={S.whatsapp} onPress={()=>Linking.openURL(`${WHATSAPP}?text=${encodeURIComponent("Hi NextGen Mobiles, I am interested in: "+activeCategory.title)}`)}><Text style={S.whatsappText}>◉  Enquire on WhatsApp</Text></Pressable></View>}</ScrollView>;
 const arrivalsScreen=<ScrollView contentContainerStyle={S.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshData} tintColor={C.orange} colors={[C.orange]}/>}><Text style={S.pageTitle}>New Arrivals</Text><Text style={S.pageSub}>Our latest skin designs and collections</Text><View style={S.arrivalGrid}>{arrivals.map((item,i)=><View key={String(i)} style={S.arrivalCard}><Pressable onPress={()=>setSelected({...item,category:"new arrivals"})}><CachedRemoteImage source={{uri:imageUrl(item.image)}} style={S.arrivalLarge}/></Pressable></View>)}</View><ContactBlock/></ScrollView>;
 const contactScreen=<ScrollView contentContainerStyle={S.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshData} tintColor={C.orange} colors={[C.orange]}/>}><Text style={S.pageTitle}>Contact Us</Text><Text style={S.pageSub}>Visit our shop or message us directly</Text><View style={S.contactCard}><Logo dark large/><View style={S.contactLine}><Text style={S.contactIcon}>⌖</Text><View style={S.contactCopy}><Text style={S.contactLabel}>ADDRESS</Text><Text style={S.contactValue}>301/4, Arogiyanathar Street, Rajamill Road, Pollachi - 642001</Text></View></View><View style={S.contactLine}><Text style={S.contactIcon}>☎</Text><View style={S.contactCopy}><Text style={S.contactLabel}>PHONE / WHATSAPP</Text><Text style={S.contactValue}>+91 {DISPLAY_PHONE}</Text></View></View></View><Pressable style={S.whatsapp} onPress={()=>Linking.openURL(`${WHATSAPP}?text=Hi%20NextGen%20Mobiles`)}><Text style={S.whatsappText}>◉  Chat on WhatsApp</Text></Pressable><Pressable style={S.callButton} onPress={()=>Linking.openURL(`tel:+91${PHONE}`)}><Text style={S.callText}>☎  Call Now</Text></Pressable><Text style={S.socialTitle}>Follow NextGen Mobiles</Text><View style={S.socialRow}>{[["Instagram","instagram","https://www.instagram.com/nextgen_mobiles_pollachi/"],["Facebook","facebook","https://facebook.com/"],["YouTube","youtube","https://youtube.com/"]].map(([label,icon,url])=><Pressable key={label} style={S.socialButton} onPress={()=>Linking.openURL(url)}><CachedRemoteImage source={{uri:SOCIAL_ICONS[icon]}} style={S.socialIcon} resizeMode="contain"/><Text style={S.socialText}>{label}</Text></Pressable>)}</View></ScrollView>;
 return <View style={S.root}><StatusBar style="light" hidden={false} /><SafeAreaView style={S.safe} edges={["top","bottom"]}><View style={S.topBar}><View style={S.headerLeft}>{tab!=="home"&&<Pressable accessibilityRole="button" accessibilityLabel="Go back" hitSlop={10} style={S.headerBack} onPress={goBackScreen}><Text style={S.headerBackText}>‹</Text></Pressable>}<Logo/></View><View style={S.topActions}><Pressable style={S.topCall} onPress={()=>Linking.openURL(`tel:+91${PHONE}`)}><Text style={S.topCallIcon}>☎</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Open profile menu" hitSlop={12} pressRetentionOffset={12} style={S.profileButton} onPress={()=>{setProfileError("");setProfileMenuOpen(true);}}><View style={S.profileHead}/><View style={S.profileShoulders}/></Pressable></View></View>{likeSaveMessage?<Text style={S.likeSaveError}>{likeSaveMessage}</Text>:null}{tab==="home"&&home}{tab==="categories"&&categoriesScreen}{tab==="arrivals"&&arrivalsScreen}{tab==="contact"&&contactScreen}<View style={S.nav}><NavItem icon="⌂" label="Home" active={tab==="home"} onPress={()=>navigateToTab("home")}/><NavItem icon="▦" label="Categories" active={tab==="categories"} onPress={()=>navigateToTab("categories")}/><NavItem icon="✦" label="Arrivals" active={tab==="arrivals"} onPress={()=>navigateToTab("arrivals")}/><NavItem icon="☎" label="Contact" active={tab==="contact"} onPress={()=>navigateToTab("contact")}/></View><Modal visible={profileMenuOpen} transparent animationType="fade" onRequestClose={()=>setProfileMenuOpen(false)}><View style={S.profileModalRoot}><View pointerEvents="none" style={StyleSheet.absoluteFillObject}/><View style={S.profileCard}><View style={S.profileCardHeader}><View><Text style={S.profileEyebrow}>GUEST PROFILE</Text><Text style={S.profileName}>{guest?.firstName} {guest?.lastName}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Close profile menu" style={S.profileClose} onPress={()=>setProfileMenuOpen(false)}><Text style={S.profileCloseText}>×</Text></Pressable></View><Text style={S.profileContact}>{guest?.contact}</Text>{profileError?<Text style={S.profileError}>{profileError}</Text>:null}<Pressable style={S.logoutButton} onPress={logoutGuest}><Text style={S.logoutText}>Log out</Text></Pressable></View></View></Modal></SafeAreaView></View>;
}

const S=StyleSheet.create({
 guestRoot:{flex:1,backgroundColor:C.paper,alignItems:"center",justifyContent:"center",padding:24},guestCard:{width:"100%",maxWidth:420,backgroundColor:C.white,borderRadius:24,padding:24,borderWidth:1,borderColor:C.line,shadowColor:"#000000",shadowOpacity:.08,shadowRadius:18,shadowOffset:{width:0,height:8},elevation:4},guestLogo:{width:138,height:138,alignSelf:"center",marginBottom:16},guestTitle:{fontSize:23,fontWeight:"900",color:C.ink,textAlign:"center"},guestSubtitle:{fontSize:14,color:C.muted,textAlign:"center",lineHeight:20,marginTop:7,marginBottom:22},guestInput:{height:52,backgroundColor:C.paper,borderRadius:13,paddingHorizontal:15,borderWidth:1,borderColor:C.line,marginBottom:12,color:C.ink,fontSize:16},guestError:{color:"#B42318",fontSize:13,lineHeight:18,marginBottom:12},guestButton:{height:52,backgroundColor:C.orange,borderRadius:13,alignItems:"center",justifyContent:"center",marginTop:3},guestButtonDisabled:{opacity:.7},guestButtonText:{color:C.white,fontSize:16,fontWeight:"900"},guestFooter:{position:"absolute",bottom:26,color:C.muted,fontSize:10,fontWeight:"800",letterSpacing:1.5},
 root:{flex:1,backgroundColor:"#171717"},safe:{flex:1,backgroundColor:C.paper},center:{flex:1,alignItems:"center",justifyContent:"center",padding:24,backgroundColor:C.paper},error:{fontSize:16,textAlign:"center",color:C.ink},likeSaveError:{color:"#B42318",backgroundColor:"#FDECEC",paddingHorizontal:14,paddingVertical:10,fontSize:12,fontWeight:"700"},loading:{marginTop:10,color:C.muted},
 topBar:{backgroundColor:C.ink,paddingHorizontal:18,paddingTop:12,paddingBottom:13,flexDirection:"row",alignItems:"center",justifyContent:"space-between"},headerLeft:{flexDirection:"row",alignItems:"center"},headerBack:{width:36,height:36,borderRadius:18,marginRight:8,backgroundColor:"#262626",alignItems:"center",justifyContent:"center"},headerBackText:{color:C.white,fontSize:27,lineHeight:30,marginTop:-2},logoWrap:{flexDirection:"row",alignItems:"center"},logoImage:{width:38,height:38,marginRight:10},logoImageLarge:{width:58,height:58},logoText:{color:C.white,fontSize:17,fontWeight:"900",letterSpacing:.5},logoTextDark:{color:C.ink},logoTextLarge:{fontSize:19},logoSub:{color:"#A9A49B",fontSize:7,marginTop:2,letterSpacing:.9},logoSubDark:{color:C.muted},logoSubLarge:{fontSize:8.5},topActions:{flexDirection:"row",alignItems:"center",gap:8},topCall:{width:40,height:40,borderRadius:20,backgroundColor:C.gold,alignItems:"center",justifyContent:"center"},topCallIcon:{fontSize:19,color:C.ink,fontWeight:"900"},profileButton:{width:40,height:40,borderRadius:20,backgroundColor:"#292929",alignItems:"center",justifyContent:"center"},profileHead:{width:9,height:9,borderRadius:5,backgroundColor:C.gold,marginBottom:2},profileShoulders:{width:19,height:9,borderTopLeftRadius:10,borderTopRightRadius:10,backgroundColor:C.gold},
 profileModalRoot:{flex:1,alignItems:"flex-end",paddingTop:62,paddingHorizontal:12,backgroundColor:"rgba(0,0,0,0.36)"},profileCard:{width:280,maxWidth:"100%",backgroundColor:C.white,borderRadius:18,padding:18,shadowColor:"#000",shadowOpacity:.18,shadowRadius:18,shadowOffset:{width:0,height:8},elevation:7},profileCardHeader:{flexDirection:"row",alignItems:"center",justifyContent:"space-between"},profileEyebrow:{fontSize:10,fontWeight:"900",letterSpacing:1.1,color:C.orange},profileName:{fontSize:18,fontWeight:"900",color:C.ink,marginTop:5},profileClose:{width:30,height:30,alignItems:"center",justifyContent:"center",borderRadius:15,backgroundColor:C.paper},profileCloseText:{fontSize:24,color:C.muted,lineHeight:27,marginTop:-2},profileContact:{fontSize:13,color:C.muted,marginTop:9},profileError:{fontSize:12,color:"#B42318",marginTop:10},logoutButton:{backgroundColor:"#FDECEC",borderRadius:11,paddingVertical:12,alignItems:"center",marginTop:18},logoutText:{color:"#B42318",fontSize:14,fontWeight:"900"},
 content:{padding:16,paddingBottom:110},homeLogoWrap:{alignItems:"center",justifyContent:"center",marginTop:-4,marginBottom:12},homeLogo:{width:112,height:112},promoBanner:{minHeight:188,backgroundColor:"#FCE5E3",borderRadius:18,padding:20,flexDirection:"row",alignItems:"center",overflow:"hidden",position:"relative"},promoCopy:{flex:1,zIndex:1},promoEyebrow:{color:C.muted,fontSize:11,letterSpacing:5,marginBottom:5},promoTitle:{color:"#A51017",fontSize:28,fontWeight:"900",letterSpacing:-.6},promoText:{color:C.ink,fontSize:11,marginTop:6},promoButton:{alignSelf:"flex-start",backgroundColor:"#D91419",paddingHorizontal:16,paddingVertical:10,borderRadius:22,marginTop:14},promoButtonText:{color:C.white,fontSize:12,fontWeight:"800"},promoImage:{position:"absolute",right:0,bottom:0,width:"43%",height:"94%"},promoPlaceholder:{position:"absolute",right:10,bottom:0,width:"38%",height:"90%",alignItems:"center",justifyContent:"center"},promoPlaceholderText:{fontSize:86},promoDots:{flexDirection:"row",justifyContent:"center",gap:8,marginTop:11,marginBottom:18},promoDotActive:{width:9,height:9,borderRadius:5,backgroundColor:"#D91419"},promoDot:{width:9,height:9,borderRadius:5,backgroundColor:"#D8D8D8"},homeCategories:{flexDirection:"row",gap:12,paddingBottom:6},homeCategory:{width:92,alignItems:"center"},homeCategoryIcon:{width:92,height:84,borderRadius:16,alignItems:"center",justifyContent:"center",backgroundColor:"#E9F3FF"},homeCategoryIconBlue:{backgroundColor:"#E9F3FF"},homeCategoryIconPink:{backgroundColor:"#FCE5F0"},homeCategoryIconMint:{backgroundColor:"#E4F7F0"},homeCategoryIconCream:{backgroundColor:"#FFF4E1"},homeCategoryGlyph:{fontSize:32,color:C.ink},homeCategoryTitle:{fontSize:12,fontWeight:"700",color:C.ink,textAlign:"center",marginTop:7,minHeight:32},
 sectionRow:{flexDirection:"row",alignItems:"flex-end",justifyContent:"space-between",marginTop:18,marginBottom:11},section:{fontSize:21,fontWeight:"900",color:C.ink,marginTop:12},hint:{fontSize:12,color:C.muted,marginTop:3},viewAll:{fontSize:13,fontWeight:"900",color:C.orange},search:{height:46,backgroundColor:C.white,borderRadius:12,paddingHorizontal:14,borderWidth:1,borderColor:C.line,marginTop:10,marginBottom:14,color:C.ink},
 catRow:{gap:11,paddingBottom:15},catGrid:{flexDirection:"row",flexWrap:"wrap",justifyContent:"space-between",gap:10,paddingBottom:8},cat:{width:"48.2%",height:125,backgroundColor:C.white,borderRadius:17,padding:14,borderWidth:1,borderColor:C.line},catIcon:{width:38,height:38,borderRadius:12,backgroundColor:C.cream,alignItems:"center",justifyContent:"center"},catIconText:{fontSize:18,color:C.orange,fontWeight:"900"},catTitle:{fontSize:17,fontWeight:"900",marginTop:12,color:C.ink},catSub:{fontSize:11,color:C.muted,marginTop:3},
 grid:{flexDirection:"row",flexWrap:"wrap",justifyContent:"space-between"},card:{width:"48.2%",backgroundColor:C.white,borderRadius:17,padding:8,marginBottom:13,borderWidth:1,borderColor:C.line},pressed:{opacity:.82},cardImageWrap:{position:"relative"},image:{width:"100%",aspectRatio:.86,borderRadius:12,backgroundColor:"#ECE9E2"},badge:{position:"absolute",top:8,left:8,backgroundColor:C.ink,paddingHorizontal:7,paddingVertical:4,borderRadius:6},badgeText:{color:C.gold,fontSize:8,fontWeight:"900"},name:{fontSize:14,fontWeight:"800",marginTop:10,minHeight:36,color:C.ink,lineHeight:18},cardPrice:{color:C.orange,fontSize:16,fontWeight:"900",marginTop:4},cardBottom:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginTop:9},cardEnquire:{backgroundColor:C.green,paddingHorizontal:8,paddingVertical:7,borderRadius:8,flex:1,marginRight:7},cardEnquireText:{color:C.white,fontSize:10,fontWeight:"900"},price:{color:C.orange,fontSize:15,fontWeight:"900"},arrow:{fontSize:24,color:C.orange,fontWeight:"900"},empty:{textAlign:"center",padding:30,color:C.muted},more:{alignSelf:"center",backgroundColor:C.ink,paddingHorizontal:20,paddingVertical:12,borderRadius:10,marginVertical:8},moreText:{color:C.gold,fontWeight:"900",fontSize:13},
 arrivalsScroller:{position:"relative"},arrivals:{gap:10,paddingBottom:21},arrivalsScrollShadow:{position:"absolute",right:0,top:0,bottom:21,width:58},arrivalSlide:{width:145,height:190,position:"relative"},arrival:{width:145,height:190,borderRadius:15,backgroundColor:"#EAE6DD"},likeButton:{minWidth:48,height:32,paddingHorizontal:7,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:4,borderRadius:18,backgroundColor:"rgba(255,255,255,0.96)",borderWidth:1,borderColor:"#EEE8E0",shadowColor:"#000000",shadowOpacity:0.16,shadowRadius:5,shadowOffset:{width:0,height:2},elevation:3},likeIcon:{fontSize:18,color:"#37332F",lineHeight:22},likeIconActive:{color:"#E3435A"},likeCount:{fontSize:11,fontWeight:"800",color:C.ink},imageLikeButton:{position:"absolute",top:8,right:8,zIndex:2},detailLikeButton:{position:"absolute",top:18,right:18,zIndex:2},footer:{backgroundColor:C.ink,borderRadius:20,padding:20,marginTop:10},footerEyebrow:{color:C.gold,fontSize:10,fontWeight:"900",letterSpacing:1.4},footerTitle:{color:C.white,fontSize:22,fontWeight:"900",marginTop:7},footerText:{color:"#BEB9B0",fontSize:13,lineHeight:19,marginTop:7},footerButton:{alignSelf:"flex-start",backgroundColor:C.gold,paddingHorizontal:15,paddingVertical:11,borderRadius:9,marginTop:15},footerButtonText:{color:C.ink,fontWeight:"900"},
 pageTitle:{fontSize:30,fontWeight:"900",color:C.ink,marginTop:4},pageSub:{fontSize:13,color:C.muted,marginTop:4,marginBottom:18},categoryList:{gap:10,marginBottom:10},categoryInfo:{backgroundColor:C.white,borderRadius:18,borderWidth:1,borderColor:C.line,padding:22,alignItems:"center",marginTop:6},categoryInfoIcon:{fontSize:34,color:C.orange,fontWeight:"900"},categoryInfoTitle:{fontSize:21,fontWeight:"900",color:C.ink,marginTop:10,textAlign:"center"},categoryInfoText:{fontSize:13,color:C.muted,lineHeight:20,textAlign:"center",marginTop:7},categoryLarge:{backgroundColor:C.white,borderWidth:1,borderColor:C.line,borderRadius:16,padding:14,flexDirection:"row",alignItems:"center"},categoryLargeActive:{borderColor:C.gold,borderWidth:2},categoryLargeIcon:{width:46,height:46,borderRadius:14,backgroundColor:C.cream,alignItems:"center",justifyContent:"center"},categoryCopy:{flex:1,marginLeft:13},categoryTitle:{fontSize:17,fontWeight:"900"},categorySub:{fontSize:12,color:C.muted,marginTop:2},categoryArrow:{fontSize:28,color:C.orange},arrivalGrid:{flexDirection:"row",flexWrap:"wrap",justifyContent:"space-between"},arrivalCard:{width:"48.5%",backgroundColor:C.white,borderRadius:15,padding:7,marginBottom:12,borderWidth:1,borderColor:C.line},arrivalLarge:{width:"100%",aspectRatio:.78,borderRadius:10,backgroundColor:"#EAE6DD"},
 contactCard:{backgroundColor:C.white,borderRadius:20,padding:18,borderWidth:1,borderColor:C.line},contactLine:{flexDirection:"row",marginTop:24},contactIcon:{fontSize:23,color:C.orange,width:36},contactCopy:{flex:1},contactLabel:{fontSize:9,fontWeight:"900",letterSpacing:1,color:C.muted},contactValue:{fontSize:14,fontWeight:"700",color:C.ink,lineHeight:21,marginTop:3},whatsapp:{backgroundColor:C.green,borderRadius:12,padding:15,alignItems:"center",justifyContent:"center",marginTop:15},whatsappText:{color:C.white,fontWeight:"900",fontSize:15},callButton:{backgroundColor:C.ink,borderRadius:12,padding:15,alignItems:"center",marginTop:10},callText:{color:C.gold,fontWeight:"900",fontSize:15},socialTitle:{fontSize:18,fontWeight:"900",marginTop:27,marginBottom:11},socialRow:{flexDirection:"row",gap:10},socialButton:{backgroundColor:C.white,borderWidth:1,borderColor:C.line,paddingHorizontal:15,paddingVertical:12,borderRadius:12,alignItems:"center",justifyContent:"center",minWidth:92},socialIcon:{width:22,height:22},socialText:{fontWeight:"800",fontSize:12,marginTop:6,color:C.ink},
 nav:{position:"absolute",left:0,right:0,bottom:0,height:73,backgroundColor:C.white,borderTopWidth:1,borderTopColor:C.line,flexDirection:"row",justifyContent:"space-around",paddingTop:8,paddingBottom:8},navItem:{alignItems:"center",justifyContent:"center",flex:1},navIcon:{fontSize:20,color:"#9A958C"},navLabel:{fontSize:10,color:"#9A958C",fontWeight:"700",marginTop:3},active:{color:C.orange,fontWeight:"900"},
 detail:{padding:16,paddingBottom:40},back:{fontSize:17,fontWeight:"900",color:C.ink},detailImageWrap:{position:"relative",backgroundColor:C.white,borderRadius:20,padding:10,borderWidth:1,borderColor:C.line},detailImageTap:{width:"100%"},detailImage:{width:"100%",height:410},zoomSafe:{flex:1,backgroundColor:"#080808"},zoomClose:{position:"absolute",right:18,top:12,zIndex:2,width:44,height:44,borderRadius:22,backgroundColor:"rgba(255,255,255,0.16)",alignItems:"center",justifyContent:"center"},zoomCloseText:{fontSize:32,color:C.white,lineHeight:36,marginTop:-3},zoomGestureArea:{flex:1,width:"100%",alignItems:"center",justifyContent:"center",overflow:"hidden"},zoomImage:{width:"100%",height:"100%"},zoomHint:{color:"#FFFFFFB3",fontSize:13,textAlign:"center",paddingVertical:16},category:{color:C.orange,fontSize:11,fontWeight:"900",marginTop:18,letterSpacing:1.3},detailName:{fontSize:29,fontWeight:"900",marginTop:6,color:C.ink},detailPrice:{color:C.orange,fontSize:24,fontWeight:"900",marginTop:9},infoBox:{backgroundColor:C.cream,borderRadius:14,padding:15,marginTop:17},infoTitle:{fontSize:14,fontWeight:"900",color:C.ink},desc:{color:"#625E57",fontSize:14,lineHeight:21,marginTop:5}
});

export default function App(){ return <SafeAreaProvider><AppContent /></SafeAreaProvider>; }
