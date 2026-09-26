import { render } from '@solidjs/testing-library';
import { describe, expect, test } from 'vitest';

import UsersLayout from './users';

describe('<UsersLayout />', () => {
  test('renders its navigation heading and nested route content', () => {
    const { getByRole, getByText } = render(() => (
      <UsersLayout>
        <p>Nested user content</p>
      </UsersLayout>
    ));

    expect(getByRole('heading', { name: 'Users' })).toBeInTheDocument();
    expect(getByText('Nested user content')).toBeInTheDocument();
  });
});
