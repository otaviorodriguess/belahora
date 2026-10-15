import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Check, ArrowLeft, CalendarDays, Clock3 } from 'lucide-react';
import type { Catalog, Receipt, PublicBookingInput } from '../../shared/booking';
import { publicCatalog, publicSlots, publicConfirm } from '../services/publicBooking';
import { todayKey, money, displayDate } from '../utils/dates';
export function PublicBookingPage({ code }: { code: string }) {
  const [catalog, setCatalog] = useState<Catalog | null>(null),
    [serviceId, setServiceId] = useState(''),
    [date, setDate] = useState(todayKey),
    [slots, setSlots] = useState<string[]>([]),
    [start, setStart] = useState(''),
    [name, setName] = useState(''),
    [phone, setPhone] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [loadingSlots, setLoadingSlots] = useState(false),
    [receipt, setReceipt] = useState<Receipt | null>(null),
    [review, setReview] = useState(false),
    [retry, setRetry] = useState(0);
  const pending = useRef<PublicBookingInput | null>(null),
    lock = useRef(false);
  useEffect(() => {
    let active = true;
    setError('');
    void publicCatalog(code)
      .then((c) => {
        if (active) setCatalog(c);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [code, retry]);
  useEffect(() => {
    let active = true;
    setSlots([]);
    setStart('');
    if (!serviceId) return;
    setLoadingSlots(true);
    setError('');
    void publicSlots(code, serviceId, date)
      .then((s) => {
        if (active) setSlots(s);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoadingSlots(false);
      });
    return () => {
      active = false;
    };
  }, [code, serviceId, date, retry]);
  const service = catalog?.services.find((s) => s.id === serviceId);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!review) {
      setReview(true);
      return;
    }
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    const input = {
      code,
      serviceId,
      date,
      start,
      name: name.trim(),
      phone: phone.replace(/\D/g, ''),
    };
    if (
      !pending.current ||
      JSON.stringify({ ...pending.current, operationId: undefined }) !== JSON.stringify(input)
    )
      pending.current = { ...input, operationId: crypto.randomUUID() };
    try {
      setReceipt(await publicConfirm(pending.current));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível confirmar. Tente novamente.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <main className="public-booking">
      <header className="booking-brand">
        <span className="eyebrow">BELA HORA · AGENDAMENTO</span>
        <p>Um tempo para cuidar de você.</p>
      </header>
      <section className="panel booking-card">
        {receipt ? (
          <div className="booking-success">
            <span className="booking-check">
              <Check size={32} />
            </span>
            <span className="eyebrow">ESTÁ COMBINADO</span>
            <h1>Seu horário está reservado.</h1>
            <p>{catalog?.studio}</p>
            <div className="booking-summary">
              <strong>{receipt.serviceName}</strong>
              <p>
                <CalendarDays size={18} />
                {displayDate(receipt.date)} · {receipt.start}
              </p>
              <p>
                <Clock3 size={18} />
                Até {receipt.end} · {money(receipt.price)}
              </p>
            </div>
            <p className="helper">
              Guarde esta confirmação. Para alterar ou cancelar, fale diretamente com a
              profissional.
            </p>
            <small>Referência: {receipt.reference}</small>
          </div>
        ) : (
          <>
            <span className="eyebrow">{catalog?.professional || 'BEM-VINDA'}</span>
            <h1>{catalog?.studio || 'Agende seu cuidado'}</h1>
            <p className="muted">Escolha o serviço e o melhor horário para você.</p>
            {error && (
              <p role="alert" className="error-message">
                {error}
              </p>
            )}
            {!catalog ? (
              <>
                <p role="status">{error ? 'A agenda não pôde ser aberta.' : 'Abrindo agenda…'}</p>
                {error && (
                  <button className="button secondary" onClick={() => setRetry((n) => n + 1)}>
                    Tentar novamente
                  </button>
                )}
              </>
            ) : (
              <form onSubmit={(e) => void submit(e)}>
                {!review ? (
                  <>
                    <fieldset disabled={busy}>
                      <legend>1. Seu cuidado</legend>
                      <div className="booking-services">
                        {catalog.services.map((s) => (
                          <button
                            type="button"
                            className={`booking-service ${serviceId === s.id ? 'selected' : ''}`}
                            aria-pressed={serviceId === s.id}
                            key={s.id}
                            onClick={() => setServiceId(s.id)}
                          >
                            <strong>{s.nome}</strong>
                            <span>
                              {s.duracao} min · {money(s.preco)}
                            </span>
                          </button>
                        ))}
                      </div>
                      {!catalog.services.length && <p>Nenhum serviço disponível no momento.</p>}
                    </fieldset>
                    {service && (
                      <>
                        <fieldset>
                          <legend>2. Dia e horário</legend>
                          <label className="field">
                            Dia
                            <input
                              type="date"
                              required
                              value={date}
                              min={todayKey()}
                              onChange={(e) => setDate(e.target.value)}
                            />
                          </label>
                          <p className="helper">
                            Horários de Brasília. Reserve com pelo menos duas horas de antecedência.
                          </p>
                          {loadingSlots ? (
                            <p role="status">Consultando horários…</p>
                          ) : (
                            <div className="booking-slots">
                              {slots.map((s) => (
                                <button
                                  type="button"
                                  key={s}
                                  aria-pressed={start === s}
                                  className={`button ${start === s ? '' : 'secondary'}`}
                                  onClick={() => setStart(s)}
                                >
                                  {s}
                                </button>
                              ))}
                            </div>
                          )}
                          {!loadingSlots && !slots.length && (
                            <p>Sem horários disponíveis neste dia. Escolha outra data.</p>
                          )}
                        </fieldset>
                        <fieldset>
                          <legend>3. Seus dados</legend>
                          <label className="field">
                            Seu nome
                            <input
                              required
                              maxLength={100}
                              autoComplete="name"
                              value={name}
                              onChange={(e) => setName(e.target.value)}
                            />
                          </label>
                          <label className="field">
                            Telefone com DDD
                            <input
                              required
                              type="tel"
                              autoComplete="tel"
                              maxLength={20}
                              value={phone}
                              onChange={(e) => setPhone(e.target.value)}
                            />
                          </label>
                          <p className="helper">
                            Seus dados serão usados pela profissional para este atendimento.
                          </p>
                        </fieldset>
                        <button
                          className="button"
                          disabled={
                            !start ||
                            !name.trim() ||
                            !/^(?:55)?\d{10,11}$/.test(phone.replace(/\D/g, ''))
                          }
                        >
                          Revisar agendamento
                        </button>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="text-button"
                      disabled={busy}
                      onClick={() => {
                        setReview(false);
                        setRetry((n) => n + 1);
                      }}
                    >
                      <ArrowLeft size={16} />
                      Alterar escolha
                    </button>
                    <h2>Está tudo certo?</h2>
                    <div className="booking-summary">
                      <strong>{service?.nome}</strong>
                      <p>
                        {displayDate(date)} · {start}
                      </p>
                      <p>
                        {service?.duracao} minutos · {money(service?.preco || 0)}
                      </p>
                      <p>
                        {name} · {phone}
                      </p>
                    </div>
                    <p className="helper">
                      O horário será confirmado ao concluir. Nenhum pagamento será cobrado aqui.
                    </p>
                    <button className="button" disabled={busy}>
                      {busy ? 'Confirmando…' : 'Confirmar agendamento'}
                    </button>
                  </>
                )}
              </form>
            )}
          </>
        )}
      </section>
      <footer className="booking-footer">Feito com cuidado · Bela Hora</footer>
    </main>
  );
}
