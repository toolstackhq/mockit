import { expect } from '@playwright/test';
import { equals } from '../../src/index.js';
import { test } from './support/mockit-demo.fixture.js';

test('updates balance in the UI after overriding a running mock', async ({ page, appUrl, remoteMock }) => {
  await page.goto(appUrl);

  await page.getByRole('button', { name: 'Check balance' }).click();
  await expect(page.getByTestId('balance-value')).toHaveText('200 AUD');

  await remoteMock.expect('/api/balance')
    .method('GET')
    .count(0)
    .returns(200)
    .withBody({ balance: 500, currency: 'AUD' })
    .apply();

  await page.getByRole('button', { name: 'Check balance' }).click();
  await expect(page.getByTestId('balance-value')).toHaveText('500 AUD');
});

test('shows invalid username when the running mock is overridden by request body', async ({ page, appUrl, remoteMock }) => {
  await remoteMock.expect('/api/login')
    .method('POST')
    .count(1)
    .matchBody('$.username', equals('john'))
    .returns(401)
    .withBody({ message: 'invalid username' })
    .apply();

  await page.goto(appUrl);
  await page.getByLabel('Username').fill('john');
  await page.getByLabel('Password').fill('b');
  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page.getByTestId('login-status')).toHaveText('invalid username');
  await expect(page.getByTestId('login-status')).toHaveClass(/error/);
});
