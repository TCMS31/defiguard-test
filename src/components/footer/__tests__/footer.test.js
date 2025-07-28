import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import Footer from '..';

describe('Footer newsletter', () => {
  it('acknowledges a sign-up and says plainly that nothing is sent', async () => {
    render(
      <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <Footer />
      </MemoryRouter>
    );

    await userEvent.type(screen.getByLabelText(/email address/i), 'reader@example.com');
    await userEvent.click(screen.getByRole('button', { name: /subscribe/i }));

    expect(screen.getByRole('status')).toHaveTextContent(/does not send email/i);
  });
});
