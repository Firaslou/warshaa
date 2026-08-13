import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Heart, MessageCircle, HandHeart, KeyRound, User as UserIcon } from "lucide-react";
import { PageLayout } from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export default function MyAccount() {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [likedProducts, setLikedProducts] = useState<any[]>([]);
  const [supported, setSupported] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [newPwd, setNewPwd] = useState("");
  const [newPwd2, setNewPwd2] = useState("");

  useEffect(() => {
    if (!loading && !user) navigate("/login");
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      setProfile(p);

      const { data: likes } = await supabase
        .from("product_likes")
        .select("product_id, products(id,name,images,startup_id,startups(slug,name))")
        .eq("user_id", user.id)
        .limit(20);
      setLikedProducts(likes ?? []);

      const { data: favs } = await supabase
        .from("favorites")
        .select("startup_id, startups(id,slug,name,city,cover_url)")
        .eq("user_id", user.id);
      setSupported(favs ?? []);

      const { data: cs } = await supabase
        .from("product_comments")
        .select("id,content,created_at,product_id,products(name)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      setComments(cs ?? []);
    })();
  }, [user]);

  const changePassword = async () => {
    if (newPwd.length < 8) {
      toast({ title: "Mot de passe trop court (min 8)", variant: "destructive" });
      return;
    }
    if (newPwd !== newPwd2) {
      toast({ title: "Les mots de passe ne correspondent pas", variant: "destructive" });
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPwd });
    if (error) toast({ title: error.message, variant: "destructive" });
    else {
      toast({ title: t("myAccount.passwordChanged") });
      setNewPwd(""); setNewPwd2("");
    }
  };

  if (!user) return null;

  return (
    <PageLayout>
      <section className="container py-12">
        <div className="mb-8 flex items-center gap-4">
          <Avatar className="h-20 w-20">
            <AvatarImage src={profile?.avatar_url ?? undefined} />
            <AvatarFallback><UserIcon /></AvatarFallback>
          </Avatar>
          <div>
            <h1 className="font-serif text-3xl font-bold">{profile?.full_name ?? user.email}</h1>
            <p className="text-muted-foreground">{user.email}</p>
            {profile?.city && <p className="text-sm text-muted-foreground">{profile.city}</p>}
          </div>
        </div>

        <Tabs defaultValue="activity" className="w-full">
          <TabsList>
            <TabsTrigger value="activity">{t("myAccount.myActivity")}</TabsTrigger>
            <TabsTrigger value="info">{t("myAccount.personalInfo")}</TabsTrigger>
            <TabsTrigger value="password">{t("myAccount.changePassword")}</TabsTrigger>
          </TabsList>

          <TabsContent value="activity" className="grid gap-6 md:grid-cols-3">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Heart className="h-4 w-4 text-primary"/>{t("myAccount.likedPosts")}</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {likedProducts.length === 0 && <p className="text-sm text-muted-foreground">—</p>}
                {likedProducts.map((l: any) => (
                  <div key={l.product_id} className="text-sm">{l.products?.name}</div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><HandHeart className="h-4 w-4 text-primary"/>{t("myAccount.supportedCreators")}</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {supported.length === 0 && <p className="text-sm text-muted-foreground">—</p>}
                {supported.map((s: any) => (
                  <button key={s.startup_id} className="block text-left text-sm hover:text-primary"
                    onClick={() => navigate(`/startup/${s.startups?.slug}`)}>
                    {s.startups?.name}
                  </button>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><MessageCircle className="h-4 w-4 text-primary"/>{t("myAccount.myComments")}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {comments.length === 0 && <p className="text-sm text-muted-foreground">—</p>}
                {comments.map((c: any) => (
                  <div key={c.id} className="text-sm">
                    <p className="font-medium">{c.products?.name}</p>
                    <p className="text-muted-foreground">{c.content}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="info">
            <Card>
              <CardContent className="space-y-3 pt-6">
                <div><Label>Email</Label><Input value={user.email ?? ""} disabled /></div>
                <div><Label>{t("auth.fullName")}</Label><Input value={profile?.full_name ?? ""} disabled /></div>
                <div><Label>{t("common.city")}</Label><Input value={profile?.city ?? ""} disabled /></div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="password">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4"/>{t("myAccount.changePassword")}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div><Label>{t("myAccount.newPassword")}</Label><Input type="password" value={newPwd} onChange={(e)=>setNewPwd(e.target.value)} /></div>
                <div><Label>{t("myAccount.confirmNewPassword")}</Label><Input type="password" value={newPwd2} onChange={(e)=>setNewPwd2(e.target.value)} /></div>
                <Button onClick={changePassword} className="gradient-warm text-primary-foreground">{t("common.save")}</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Separator className="my-12" />
        <p className="text-center text-sm italic text-muted-foreground">{t("stats.supportLine")}</p>
      </section>
    </PageLayout>
  );
}
