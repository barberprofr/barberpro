# TODO: Supprimer l'email du client dans le frontend

## Étapes à suivre :
- [ ] Supprimer les états newClientEmail et newClientEmailConfirm
- [ ] Supprimer les useMemo pour sanitizedNewClientEmail et sanitizedNewClientEmailConfirm
- [ ] Ajuster usingNewClient pour exclure les champs email
- [ ] Ajuster newClientFormComplete et newClientFormValid pour ne pas valider l'email
- [ ] Supprimer les inputs email et confirmation email du JSX
- [ ] Ajuster clientSummary et clientSelectionTitle pour ne pas afficher l'email
- [ ] Supprimer les validations email dans onSubmit
- [ ] Supprimer les toasts liés à l'email
- [ ] Tester les changements
