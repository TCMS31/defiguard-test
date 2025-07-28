import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import Header from '..';

function renderHeader() {
  return render(
    <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <Header />
    </MemoryRouter>
  );
}

describe('Header', () => {
  it('opens and closes the collapsed menu without Bootstrap JavaScript', async () => {
    renderHeader();

    const toggle = screen.getByRole('button', { name: /open navigation/i });
    const menu = screen.getByTestId('nav-menu');

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(menu).not.toHaveClass('show');

    await userEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveAccessibleName(/close navigation/i);
    expect(menu).toHaveClass('show');

    await userEvent.click(screen.getByRole('link', { name: 'Wallet' }));

    expect(menu).not.toHaveClass('show');
  });
});
