-- Admins can read all chats
CREATE POLICY "Admins view all conversations" ON public.chat_conversations FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins view all messages" ON public.chat_messages FOR SELECT USING (has_role(auth.uid(), 'admin'));

-- Admins can delete/manage products
CREATE POLICY "Admins delete products" ON public.products FOR DELETE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update products" ON public.products FOR UPDATE USING (has_role(auth.uid(), 'admin'));