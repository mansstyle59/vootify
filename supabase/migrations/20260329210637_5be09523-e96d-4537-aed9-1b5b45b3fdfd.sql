UPDATE home_config SET sections = jsonb_set(
  sections::jsonb,
  '{sections}',
  (
    SELECT jsonb_agg(
      CASE 
        WHEN elem->>'id' IN ('recently_added', 'top_artists', 'artists', 'albums', 'recommended', 'most_played', 'recently_listened')
        THEN jsonb_set(elem, '{visible}', 'true')
        ELSE elem
      END
    )
    FROM jsonb_array_elements(sections::jsonb->'sections') AS elem
  )
) WHERE id = '6e51ac46-3326-4ea1-adf8-ae1abf23497a';