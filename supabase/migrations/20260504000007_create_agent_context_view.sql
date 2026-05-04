create or replace view agent_context_v as
select
  o.id as org_id,
  o.name as org_name,
  o.data as org_profile,
  (
    select jsonb_build_object(
      'total', count(*),
      'uploaded', count(*) filter (where status = 'uploaded'),
      'missing_list', coalesce(
        jsonb_agg(jsonb_build_object('doc_name', doc_name, 'required_for', required_for))
          filter (where status = 'missing'),
        '[]'::jsonb
      )
    )
    from document_vault dv
    where dv.org_id = o.id
  ) as documents,
  (
    select jsonb_agg(
      jsonb_build_object(
        'id', g.id,
        'name', g.name,
        'amount', g.amount,
        'deadline', g.deadline,
        'match_score', g.match_score,
        'status', g.status
      )
      order by g.match_score desc nulls last
    )
    from (
      select * from grant_opportunities
      where org_id = o.id and status not in ('expired', 'rejected', 'skipped')
      order by match_score desc nulls last
      limit 5
    ) g
  ) as top_grants,
  (
    select jsonb_agg(
      jsonb_build_object('id', id, 'name', name, 'deadline', deadline)
      order by deadline asc
    )
    from grant_opportunities
    where org_id = o.id
      and deadline is not null
      and deadline::date between current_date and current_date + 30
      and status not in ('expired', 'rejected', 'skipped')
  ) as upcoming_deadlines
from orgs o;
