-- 1. Trigger: Pomniejsz current_quantity w t_batches przy INSERT do t_production_inputs
CREATE OR REPLACE FUNCTION public.reduce_batch_quantity_on_input()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    -- Pomniejsz stan partii o wagę wsadu
    UPDATE public.t_batches
    SET 
        current_quantity = GREATEST(0, current_quantity - NEW.weight),
        updated_at = NOW()
    WHERE id = NEW.batch_id;
    
    RETURN NEW;
END;
$$;

-- Usuń istniejący trigger jeśli istnieje
DROP TRIGGER IF EXISTS trg_reduce_batch_on_input ON public.t_production_inputs;

-- Utwórz trigger
CREATE TRIGGER trg_reduce_batch_on_input
AFTER INSERT ON public.t_production_inputs
FOR EACH ROW
EXECUTE FUNCTION public.reduce_batch_quantity_on_input();

-- 2. Funkcja zamykająca zlecenie i tworząca partie wynikowe
CREATE OR REPLACE FUNCTION public.close_production_order_with_batches(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_order RECORD;
    v_product RECORD;
    v_batch_id UUID;
    v_batch_number TEXT;
    v_total_weight DECIMAL(10,2);
    v_created_batches JSONB := '[]'::JSONB;
BEGIN
    -- Pobierz zlecenie
    SELECT * INTO v_order FROM public.t_production_orders WHERE id = p_order_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found: %', p_order_id;
    END IF;
    
    IF v_order.status != 'Open' THEN
        RAISE EXCEPTION 'Order is not open: %', v_order.status;
    END IF;
    
    -- Dla każdego unikalnego produktu w logach produkcyjnych
    FOR v_product IN 
        SELECT 
            pl.product_id,
            p.name as product_name,
            p.sku,
            p.default_expiration_days,
            SUM(pl.weight_net) as total_net_weight
        FROM public.t_production_logs pl
        JOIN public.t_products p ON p.id = pl.product_id
        WHERE pl.production_order_id = p_order_id
        GROUP BY pl.product_id, p.name, p.sku, p.default_expiration_days
    LOOP
        -- Generuj numer partii
        v_batch_number := TO_CHAR(NOW(), 'YYYYMMDD') || '/' || COALESCE(v_product.sku, 'XXX') || '/' || 
            LPAD((SELECT COUNT(*) + 1 FROM public.t_batches WHERE internal_batch_number LIKE TO_CHAR(NOW(), 'YYYYMMDD') || '/' || COALESCE(v_product.sku, 'XXX') || '/%')::TEXT, 3, '0');
        
        -- Utwórz partię wynikową
        INSERT INTO public.t_batches (
            product_id,
            internal_batch_number,
            initial_quantity,
            current_quantity,
            production_date,
            expiration_date,
            status
        ) VALUES (
            v_product.product_id,
            v_batch_number,
            v_product.total_net_weight,
            v_product.total_net_weight,
            CURRENT_DATE,
            CURRENT_DATE + COALESCE(v_product.default_expiration_days, 30),
            'Released'
        )
        RETURNING id INTO v_batch_id;
        
        -- Zaktualizuj logi produkcyjne - przypisz partię wynikową
        UPDATE public.t_production_logs
        SET output_batch_id = v_batch_id
        WHERE production_order_id = p_order_id
        AND product_id = v_product.product_id;
        
        -- Dodaj do listy utworzonych partii
        v_created_batches := v_created_batches || jsonb_build_object(
            'batch_id', v_batch_id,
            'batch_number', v_batch_number,
            'product_name', v_product.product_name,
            'quantity', v_product.total_net_weight
        );
    END LOOP;
    
    -- Zamknij zlecenie
    UPDATE public.t_production_orders
    SET status = 'Closed', updated_at = NOW()
    WHERE id = p_order_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'order_id', p_order_id,
        'created_batches', v_created_batches
    );
END;
$$;

-- 3. Dodaj kolumnę output_batch_id do t_production_logs jeśli nie istnieje
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 't_production_logs' 
        AND column_name = 'output_batch_id'
    ) THEN
        ALTER TABLE public.t_production_logs 
        ADD COLUMN output_batch_id UUID REFERENCES public.t_batches(id);
    END IF;
END $$;