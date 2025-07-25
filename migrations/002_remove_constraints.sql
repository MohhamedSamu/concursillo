-- Migration: 002_remove_constraints
-- Description: Remove order constraints from questions table

-- Drop existing constraints
ALTER TABLE public.questions 
  DROP CONSTRAINT IF EXISTS questions_order_number_check,
  DROP CONSTRAINT IF EXISTS questions_questionnaire_id_order_number_key;

-- Make sure we have the correct foreign key constraint
ALTER TABLE public.questions 
  DROP CONSTRAINT IF EXISTS questions_questionnaire_id_fkey;

ALTER TABLE public.questions 
  ADD CONSTRAINT questions_questionnaire_id_fkey 
  FOREIGN KEY (questionnaire_id) 
  REFERENCES public.questionnaires(id) 
  ON DELETE CASCADE;

-- Re-create the index for performance
DROP INDEX IF EXISTS questions_questionnaire_id_idx;
CREATE INDEX questions_questionnaire_id_idx ON public.questions(questionnaire_id); 