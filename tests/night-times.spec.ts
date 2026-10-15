import { test, expect } from '@playwright/test';
test('expediente até 20h e seleção noturna sem rolagem interna', async ({ page }) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  await page.getByRole('button',{name:'Novo agendamento',exact:true}).click();
  await page.getByLabel('Cliente',{exact:true}).fill('Cliente Noite');
  await page.getByLabel('Data',{exact:true}).fill('2026-10-02');
  await page.getByRole('button',{name:/^Noite/}).click();
  await expect(page.getByRole('button',{name:'18:00',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'19:00',exact:true}).click();
  await expect(page.getByLabel('Horário',{exact:true})).toHaveValue('19:00');
  await expect(page.getByRole('button',{name:'19:15',exact:true})).toHaveCount(0);
  await expect(page.getByText('Término previsto:')).toContainText('20:00');
  expect(await page.locator('.time-slots').evaluate(el => el.scrollHeight <= el.clientHeight)).toBe(true);
  await page.screenshot({path:'work/night-times.png',fullPage:true});
  await page.getByRole('button',{name:'Salvar agendamento',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.appointment-card')).toContainText('19:00');
});
test('atualiza expediente antigo uma vez e preserva ajustes posteriores', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button',{name:'Novo agendamento',exact:true}).click();
  await expect(page.getByRole('button',{name:'Salvar agendamento',exact:true})).toBeEnabled();
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve,reject) => { const req=indexedDB.open('aura-local-agenda',1); req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error); });
    await new Promise<void>((resolve,reject)=>{const tx=db.transaction('agenda','readwrite');const store=tx.objectStore('agenda');const req=store.get('current');req.onsuccess=()=>{const state=req.result; delete state.hoursExtendedTo20;state.settings.hours[5].end='18:00';store.put(state,'current');};tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});db.close();
  });
  await page.reload();
  await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Configurações'}).click();
  await expect(page.getByLabel('Horário final de Sexta')).toHaveValue('20:00');
  await page.getByLabel('Horário final de Sexta').fill('19:00');
  await page.getByRole('button',{name:'Salvar configurações',exact:true}).click();
  await expect(page.getByText('Tudo pronto. Sua rotina foi atualizada.')).toBeVisible();
  await page.reload();
  await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Configurações'}).click();
  await expect(page.getByLabel('Horário final de Sexta')).toHaveValue('19:00');
});
