-- Clean up automated test data (consults, messages, prescriptions, audit).
-- All current rows were created during automated end-to-end testing.
DELETE FROM public.prescription_audit
WHERE prescription_id IN (SELECT id FROM public.prescriptions);

DELETE FROM public.prescriptions;

DELETE FROM public.consult_messages;

DELETE FROM public.consults;